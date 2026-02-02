import { useEffect, useRef, useState } from 'react';
import { useKeyboard } from '@opentui/react';
import type { CommitInfo, ChangedFile } from '../utils/git';
import { getFilesInCommit } from '../utils/git';

interface HistoryViewerProps {
    commits: CommitInfo[];
    onClose: () => void;
}

export function HistoryViewer({ commits, onClose }: HistoryViewerProps) {
    const [selectedRow, setSelectedRow] = useState(0);
    const [showFileDialog, setShowFileDialog] = useState(false);
    const [fileDialogFiles, setFileDialogFiles] = useState<ChangedFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);

    const scrollRef = useRef<any>(null);

    useKeyboard((key) => {
        if (key.name === 'escape') {
            if (showFileDialog) {
                // Close file dialog if open
                setShowFileDialog(false);
            } else {
                onClose();
            }
        } else if (key.name === 'space' && commits.length > 0) {
            // Show file dialog for selected commit (Space)
            const commit = commits[selectedRow];
            if (commit) {
                setLoadingFiles(true);
                getFilesInCommit(commit.hash).then(files => {
                    setFileDialogFiles(files);
                    setShowFileDialog(true);
                    setLoadingFiles(false);
                });
            }
        } else if (scrollRef.current) {
            if (key.name === 'up') {
                if (showFileDialog) return; // Don't navigate rows when dialog is open
                setSelectedRow(prev => Math.max(0, prev - 1));
                scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 1);
            } else if (key.name === 'down') {
                if (showFileDialog) return; // Don't navigate rows when dialog is open
                setSelectedRow(prev => Math.min(commits.length - 1, prev + 1));
                scrollRef.current.scrollTop = scrollRef.current.scrollTop + 1;
            } else if (key.name === 'pageup') {
                if (showFileDialog) return; // Don't navigate rows when dialog is open
                const newRow = Math.max(0, selectedRow - 10);
                setSelectedRow(newRow);
                scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 10);
            } else if (key.name === 'pagedown') {
                if (showFileDialog) return; // Don't navigate rows when dialog is open
                const newRow = Math.min(commits.length - 1, selectedRow + 10);
                setSelectedRow(newRow);
                scrollRef.current.scrollTop = scrollRef.current.scrollTop + 10;
            }
        }
    });

    const formatMessage = (message: string, maxLength: number = 60): string => {
        if (message.length <= maxLength) {
            return message;
        }
        return message.substring(0, maxLength - 3) + '...';
    };

    const getStatusSymbol = (status: ChangedFile['status']): string => {
        // Return the first character of the Git status code directly
        return status.charAt(0) || '~';
    };

    return (
        <box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            backgroundColor="black"
            flexDirection="column"
        >
            <box height={1} backgroundColor="gray" flexDirection="row">
                <text width={10} fg="white"><strong>  Hash</strong></text>
                <text width={25} fg="white"><strong>Author</strong></text>
                <text width={20} fg="white"><strong>Date</strong></text>
                <text fg="white" flexGrow={1}><strong>Message</strong></text>
            </box>
            <scrollbox flexGrow={1} ref={scrollRef}>
                {commits.length === 0 ? (
                    <text fg="gray">No commit history found.</text>
                ) : (
                    commits.map((commit, index) => (
                        <box
                            key={`${commit.hash}-${index}`}
                            flexDirection="row"
                            height={1}
                            backgroundColor={index === selectedRow ? "blue" : "black"}
                            onMouseDown={() => {
                                // If file dialog is open, close it first
                                if (showFileDialog) {
                                    setShowFileDialog(false);
                                } else {
                                    // Otherwise, select the row
                                    setSelectedRow(index);
                                }
                            }}
                        >
                            <text width={10} fg="cyan">  {commit.hash}</text>
                            <text width={25} fg={index === selectedRow ? "white" : "brightGreen"}>{commit.author.substring(0, 24)}</text>
                            <text width={20} fg={index === selectedRow ? "white" : "yellow"}>{commit.date.substring(0, 19)}</text>
                            <text fg={index === selectedRow ? "white" : "white"} flexGrow={1}>{formatMessage(commit.message)}</text>
                        </box>
                    ))
                )}
            </scrollbox>
            <box height={1} backgroundColor="gray" flexDirection="row" justifyContent="center">
                <text fg="yellow">
                    <strong>↑↓</strong> Navigate | <strong>PgUp/PgDn</strong> Page | <strong>Space</strong> Show Files | <strong>Esc</strong> Close
                </text>
            </box>

            {/* File Dialog */}
            {showFileDialog && (
                <box
                    position="absolute"
                    top="20%"
                    left="20%"
                    width="60%"
                    height="60%"
                    backgroundColor="black"
                    border
                    flexDirection="column"
                    title={` Files Changed in ${commits[selectedRow]?.hash || ''} `}
                >
                    {loadingFiles ? (
                        <text>Loading files...</text>
                    ) : fileDialogFiles.length === 0 ? (
                        <text>No files changed in this commit.</text>
                    ) : (
                        <>
                            <scrollbox flexGrow={1}>
                                {fileDialogFiles.map((file, index) => (
                                    <box key={index} flexDirection="row" height={1}>
                                        <text width={8} fg={
                                            file.status.charAt(0) === 'A' ? 'brightGreen' :  // Added
                                            file.status.charAt(0) === 'D' ? 'red' :    // Deleted
                                            file.status.charAt(0) === 'R' ? 'yellow' : // Renamed
                                            file.status.charAt(0) === 'C' ? 'blue' :   // Copied
                                            file.status.charAt(0) === 'T' ? 'magenta' : // Type change
                                            'cyan' // Modified or other
                                        }>
                                            {'  '}{file.status.charAt(0)}  {/* Show 2 spaces padding before the raw Git status code */}
                                        </text>
                                        <text fg="white" flexGrow={1}>  {file.path}</text>
                                    </box>
                                ))}
                            </scrollbox>
                            <box height={1} backgroundColor="gray" flexDirection="row" justifyContent="center">
                                <text fg="yellow">
                                    <strong>Esc</strong> Close
                                </text>
                            </box>
                        </>
                    )}
                </box>
            )}
        </box>
    );
}
