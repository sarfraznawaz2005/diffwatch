import { useState, useEffect, useMemo, useRef } from 'react';
import { useRenderer, useKeyboard } from '@opentui/react';
import { spawn } from 'child_process';
import * as path from 'path';
import { getChangedFiles, getCurrentBranch, getBranchCount, getCommitHistory, type FileStatus, type CommitInfo, type ChangedFile, revertFile, deleteFileSafely, runGit, searchFiles } from './utils/git';
import { FileList } from './components/FileList';
import { DiffViewer } from './components/DiffViewer';
import { HistoryViewer } from './components/HistoryViewer';
import { StatusBar } from './components/StatusBar';
import { POLLING_INTERVAL } from './constants';

 export default function App() {
    const renderer = useRenderer();
     const [allFiles, setAllFiles] = useState<FileStatus[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [focused, setFocused] = useState<'fileList' | 'diffView'>('fileList');
     const [repoPath] = useState(process.cwd());
     const [branch, setBranch] = useState('...');
     const [branchCount, setBranchCount] = useState(0);
     const [confirmRevert, setConfirmRevert] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchActive, setSearchActive] = useState(false);
    const [searchResults, setSearchResults] = useState<FileStatus[] | null>(null);
     const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [errorNotification, setErrorNotification] = useState<string | null>(null);
     const [historyMode, setHistoryMode] = useState(false);
     const [commits, setCommits] = useState<CommitInfo[]>([]);

    const refresh = async (skipIfSearching = false) => {
        // Skip refresh if search is active and skipIfSearching is true
        if (skipIfSearching && searchActive) {
            return;
        }

        const newFiles = await getChangedFiles(repoPath);
        setAllFiles(newFiles);
        if (selectedIndex >= newFiles.length) {
            setSelectedIndex(Math.max(0, newFiles.length - 1));
        }
    };

    // Filter files based on search
    const filteredFiles = useMemo(() => {
        if (!searchActive || !searchQuery.trim()) {
            return allFiles;
        }
        // Return search results if available, otherwise empty array
        return searchResults ?? [];
    }, [searchActive, searchQuery, allFiles, searchResults]);

    // Execute search and update files when search is submitted
    useEffect(() => {
        const doSearch = async () => {
            if (!searchActive || !searchQuery.trim()) {
                setSearchResults(null);
                return;
            }


            try {
                // Search within the current allFiles only (by content, not filename)
                const matchedFiles = await searchFiles(searchQuery, allFiles, repoPath);
                setSearchResults(matchedFiles);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                setErrorNotification(`Search failed: ${errorMessage}`);
                setSearchResults(null);
            }
        };

        // Debounce search
        const timeout = setTimeout(doSearch, 300);
        return () => clearTimeout(timeout);
    }, [searchActive, searchQuery, repoPath, allFiles]);

    // Auto-hide notifications after 3 seconds
    useEffect(() => {
        if (notification) {
            const timeout = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timeout);
        }
    }, [notification]);

    // Load initial data
    useEffect(() => {
        refresh();
        getCurrentBranch(repoPath).then(setBranch);
        getBranchCount(repoPath).then(setBranchCount);
    }, [repoPath]);

    // Refs to store interval IDs to prevent memory leaks
    const gitPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const branchPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Poll for git changes periodically
    useEffect(() => {
        // Clear any existing interval to prevent duplicates
        if (gitPollingIntervalRef.current) {
            clearInterval(gitPollingIntervalRef.current);
        }

        gitPollingIntervalRef.current = setInterval(async () => {
            await refresh(true);
        }, POLLING_INTERVAL);

        return () => {
            if (gitPollingIntervalRef.current) {
                clearInterval(gitPollingIntervalRef.current);
                gitPollingIntervalRef.current = null;
            }
        };
    }, [repoPath, searchActive]);

    // Poll for branch changes
    useEffect(() => {
        // Clear any existing interval to prevent duplicates
        if (branchPollingIntervalRef.current) {
            clearInterval(branchPollingIntervalRef.current);
        }

        branchPollingIntervalRef.current = setInterval(async () => {
            const currentBranch = await getCurrentBranch(repoPath);
            const count = await getBranchCount(repoPath);
            setBranch(currentBranch);
            setBranchCount(count);
        }, POLLING_INTERVAL);

        return () => {
            if (branchPollingIntervalRef.current) {
                clearInterval(branchPollingIntervalRef.current);
                branchPollingIntervalRef.current = null;
            }
        };
    }, [repoPath]);

    // Load commit history when history mode is opened
    useEffect(() => {
        if (historyMode) {
            getCommitHistory(repoPath).then(setCommits);
        }
    }, [historyMode, repoPath]);

    // Open file in default editor
    const openFile = (filePath: string) => {
        try {
            const absPath = filePath.startsWith('/') || filePath.match(/^[A-Za-z]:\\/)
                ? path.normalize(filePath)
                : path.normalize(path.join(repoPath, filePath));
            const isWindows = process.platform === 'win32';
            const isMac = process.platform === 'darwin';

            if (isWindows) {
                // On Windows, use cmd to execute start command to properly handle paths with spaces
                // Pass the path directly without additional quotes since shell: false passes args directly
                spawn('cmd', ['/c', 'start', '""', absPath], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: repoPath,
                    shell: false  // Don't use shell to avoid double-quoting issues
                }).unref();
            } else {
                // On macOS and Linux, use the open command with shell: true so it handles spaces properly
                const command = isMac ? 'open' : 'xdg-open';
                spawn(command, [absPath], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: repoPath,
                    shell: true  // Use shell to handle spaces in path
                }).unref();
            }
            return; // Exit early after handling the file opening
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setErrorNotification(`Failed to open file: ${errorMessage}`);
        }
    };

    // Keyboard handling
    useKeyboard(async (key) => {
        // Dismiss error notification if present
        if (errorNotification) {
            setErrorNotification(null);
            return;
        }

        // If history mode is open, skip file-related shortcuts
        if (historyMode) {
            if (key.name === 'q') {
                renderer.destroy();
                process.exit(0);
            }
            // Allow other keys but don't process file-related shortcuts
            return;
        }

        // Search mode
        if (searchMode) {
            if (key.name === 'escape') {
                setSearchMode(false);
                setSearchQuery('');
                setSearchActive(false);
                 setSelectedIndex(0);
            } else if (key.name === 'backspace') {
                setSearchQuery(q => q.slice(0, -1));
            } else if (key.name === 'enter' || key.name === 'return') {
                setSearchActive(searchQuery.trim().length > 0);
                setSearchMode(false);
                setSelectedIndex(0);
            } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
                // Only add ASCII printable characters (space to tilde) and extended text
                if (/^[\x20\x21-\x7E\u00A0-\uFFFF]$/.test(key.sequence)) {
                    setSearchQuery(q => q + key.sequence);
                }
            }
            return;
        }

        // Confirm revert mode
        if (confirmRevert) {
            if (key.name === 'y') {
                const file = filteredFiles[selectedIndex];
                if (file) {
                    try {
                        if (file.status === 'new') {
                            await deleteFileSafely(file.path);
                            setNotification({ message: `File ${file.path} deleted.`, type: 'success' });
                        } else {
                            await revertFile(file.path);
                            setNotification({ message: `File ${file.path} reverted.`, type: 'success' });
                        }
                        await refresh();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        setErrorNotification(`Revert failed: ${errorMessage}`);
                    }
                }
            }
            setConfirmRevert(false);
            return;
        }

        // Confirm delete mode
        if (confirmDelete) {
            if (key.name === 'y') {
                const file = filteredFiles[selectedIndex];
                if (file) {
                    try {
                        const deleted = await deleteFileSafely(file.path);
                        if (deleted) {
                            setNotification({ message: `File ${file.path} deleted.`, type: 'success' });
                            await refresh();
                        } else {
                            setErrorNotification(`Failed to delete ${file.path}.`);
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        setErrorNotification(`Delete failed: ${errorMessage}`);
                    }
                }
            }
            setConfirmDelete(false);
            return;
        }

        // Global shortcuts
        if (key.name === 'q') {
            renderer.destroy();
            process.exit(0);
        }

        if (key.name === 's' && (filteredFiles.length > 0 || searchActive)) {
            setSearchMode(true);
        }

        if (key.name === 'h') {
            setHistoryMode(true);
        }

        if (key.name === 'tab' || key.name === 'left' || key.name === 'right') {
            setFocused(f => f === 'fileList' ? 'diffView' : 'fileList');
        }

        if (focused === 'fileList') {
            if (key.name === 'up') {
                setSelectedIndex(i => Math.max(0, i - 1));
            }
            if (key.name === 'down') {
                setSelectedIndex(i => Math.min(filteredFiles.length - 1, i + 1));
            }
            if (key.name === 'enter' || key.name === 'return') {
                const file = filteredFiles[selectedIndex];
                if (file) {
                    openFile(file.path);
                }
            }
            if (key.name === 'd' && (filteredFiles.length > 0 || searchActive)) {
                setConfirmDelete(true);
            }
            if (key.name === 'r' && (filteredFiles.length > 0 || searchActive)) {
                setConfirmRevert(true);
            }
        }
    });

    return (
        <box flexDirection="column" height="100%">
            <box flexDirection="row" flexGrow={1}>
                <FileList
                    files={filteredFiles}
                    selectedIndex={selectedIndex}
                    focused={focused === 'fileList'}
                    searchQuery={searchActive ? searchQuery : undefined}
                    onSelect={(index) => {
                        setSelectedIndex(index);
                        setFocused('fileList');
                    }}
                    onScroll={(delta) => {
                        setSelectedIndex(i => {
                            const next = i + (delta > 0 ? 1 : -1);
                            return Math.max(0, Math.min(filteredFiles.length - 1, next));
                        });
                    }}
                />
                <DiffViewer
                    filename={filteredFiles[selectedIndex]?.path}
                    focused={focused === 'diffView'}
                    searchQuery={searchActive ? searchQuery : undefined}
                    status={filteredFiles[selectedIndex]?.status || 'modified'}
                    repoPath={repoPath}
                />
            </box>
            <StatusBar branch={branch} branchCount={branchCount} fileCount={filteredFiles.length} searchActive={searchActive} />
            {searchMode && (
                <box
                    position="absolute"
                    top="50%"
                    left="50%"
                    width={50}
                    height={3}
                    backgroundColor="black"
                    border
                    title=" Search "
                    flexDirection="column"
                >
                    <text>{searchQuery}</text>
                </box>
            )}
            {notification && (
                <box
                    position="absolute"
                    top="50%"
                    left="50%"
                    width={50}
                    height={3}
                    backgroundColor="black"
                    border
                    title={notification.type === 'success' ? " Success " : " Error "}
                >
                    <text fg={notification.type === 'success' ? 'brightGreen' : 'brightRed'}>
                        {notification.message}
                    </text>
                </box>
            )}
            {errorNotification && (
                <box
                    position="absolute"
                    top="50%"
                    left="50%"
                    width={60}
                    height={5}
                    backgroundColor="red"
                    border
                    flexDirection="column"
                    title=" Error "
                >
                    <text fg="white">{errorNotification}</text>
                    <text fg="white">Press any key to dismiss</text>
                </box>
            )}
            {confirmRevert && (
                <box 
                    position="absolute" 
                    top="50%" 
                    left="50%" 
                    width={50} 
                    height={3}                     
                    backgroundColor="yellow" 
                    border 
                    flexDirection="column"
                    title=" Confirm Revert "
                >
                    <text fg="red">Press Y to revert or any other key to cancel</text>
                </box>
            )}
            {confirmDelete && (
                <box 
                    position="absolute" 
                    top="50%" 
                    left="50%" 
                    width={50} 
                    height={3}                     
                    backgroundColor="red" 
                    border 
                    flexDirection="column"
                    title=" Confirm Delete "
                >
                    <text fg="white">Press Y to delete or any other key to cancel</text>
                </box>
            )}
            {historyMode && (
                <HistoryViewer
                    commits={commits}
                    onClose={() => setHistoryMode(false)}
                />
            )}
        </box>
    );
}
