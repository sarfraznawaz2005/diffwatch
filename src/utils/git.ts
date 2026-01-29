import * as fs from 'fs';
import * as fsPromisesMod from 'fs/promises';
import * as pathMod from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';

// Allow dependency injection for testing
interface FsPromises {
  access: typeof fsPromisesMod.access;
  readFile: typeof fsPromisesMod.readFile;
  unlink: typeof fsPromisesMod.unlink;
  stat: typeof fsPromisesMod.stat;
}

interface Path {
  isAbsolute: typeof pathMod.isAbsolute;
  join: typeof pathMod.join;
  resolve: typeof pathMod.resolve;
}

// Default implementations using actual modules
const defaultFsPromises: FsPromises = fsPromisesMod;
const defaultPath: Path = pathMod;

export interface FileStatus {
    path: string;
    status: 'modified' | 'new' | 'deleted' | 'renamed' | 'unknown' | 'unstaged' | 'unchanged' | 'ignored';
    mtime: Date;
}

export function runGit(args: string[], cwd: string = process.cwd()): Promise<string> {
    const git = simpleGit(cwd);
    return git.raw(args);
}

export async function getChangedFiles(
    cwd: string = process.cwd(),
    fsPromises: FsPromises = defaultFsPromises,
    path: Path = defaultPath
): Promise<FileStatus[]> {
    try {
        const git = simpleGit(cwd);
        const status = await git.status();
        const root = await getRepoRoot(cwd);

        const uniquePaths = new Set<string>();
        const fileList: FileStatus[] = [];

        // Helper function to add file if not already added
        const addFileIfUnique = (filePath: string, fileStatus: FileStatus['status']) => {
            if (!uniquePaths.has(filePath)) {
                uniquePaths.add(filePath);
                fileList.push({
                    path: filePath,
                    status: fileStatus,
                    mtime: new Date(0)
                });
            }
        };

        // Parse status.files array - this is more reliable than precomputed arrays
        // Git returns compound status strings like "AD" (Added + Deleted), "AM", "MD", etc.
        if (status.files && Array.isArray(status.files)) {
            status.files.forEach((file) => {
                const indexStatus = file.index || ' ';
                const workingDirStatus = file.working_dir || ' ';
                const filePath = file.path;

                // Renamed: check if file is in status.renamed array
                if (status.renamed && status.renamed.some(r => r.to === filePath || r.from === filePath)) {
                    addFileIfUnique(filePath, 'renamed');
                    return;
                }

                // Deleted: index has 'D' or working_dir has 'D'
                // Compound status can be "AD", "D", "MD", etc.
                if (indexStatus.includes('D') || workingDirStatus.includes('D')) {
                    addFileIfUnique(filePath, 'deleted');
                    return;
                }

                // New: both index and working_dir are '?'
                if (indexStatus === '?' && workingDirStatus === '?') {
                    addFileIfUnique(filePath, 'new');
                    return;
                }

                // Staged: index has 'A' (not empty, not just '?')
                // Compound status can be "A", "AM", "AD", etc.
                if (indexStatus.includes('A') && indexStatus !== '?') {
                    addFileIfUnique(filePath, 'modified');
                    return;
                }

                // Unstaged modified: index is empty ' ' and working_dir is 'M'
                // Or index has 'M' and working_dir is anything
                if ((indexStatus === ' ' || indexStatus === 'M') && (workingDirStatus === 'M' || workingDirStatus.includes('M'))) {
                    addFileIfUnique(filePath, 'unstaged');
                    return;
                }
            });
        } else {
            // Fallback to the old format for backward compatibility
            // Handle modified files
            (status.modified || []).forEach((file: string) => {
                addFileIfUnique(file, 'unstaged');
            });

            // Handle staged files
            (status.staged || []).forEach((file: string) => {
                addFileIfUnique(file, 'modified');
            });

            // Handle not_added (new) files
            (status.not_added || []).forEach((file: string) => {
                addFileIfUnique(file, 'new');
            });

            // Handle deleted files
            (status.deleted || []).forEach((file: string) => {
                addFileIfUnique(file, 'deleted');
            });

            // Handle renamed files
            (status.renamed || []).forEach((rename: { from: string; to: string }) => {
                addFileIfUnique(rename.to, 'renamed');
            });
        }

        // Add mtime to all files
        await Promise.all(fileList.map(async (f) => {
            try {
                const absPath = path.isAbsolute(f.path) ? f.path : path.join(root, f.path);
                const stat = await fsPromises.stat(absPath);
                f.mtime = stat.mtime;
            } catch (error) {
                // For deleted or inaccessible files, use epoch time
                f.mtime = new Date(0);
            }
        }));

        // Sort by mtime descending, then by filename
        return fileList.sort((a, b) => {
            const mtimeA = a.mtime || new Date(0);
            const mtimeB = b.mtime || new Date(0);
            const timeDiff = mtimeB.getTime() - mtimeA.getTime();
            if (timeDiff !== 0) {
                return timeDiff;
            }
            return a.path.localeCompare(b.path);
        });
    } catch (error) {
        // For this function, returning an empty array is better than crashing the app
        // Git operations can fail for many reasons (not a git repo, etc.)
        return [];
    }
}

export async function getFileContent(
    filePath: string,
    cwd: string = process.cwd(),
    fsPromises: FsPromises = defaultFsPromises,
    path: Path = defaultPath
): Promise<string> {
    try {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
        await fsPromises.access(absolutePath);
        return await fsPromises.readFile(absolutePath, 'utf-8');
    } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error);
        return '';
    }
}

export async function getCurrentBranch(cwd: string = process.cwd()): Promise<string> {
    try {
        const git = simpleGit(cwd);
        const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
        return branch;
    } catch (error) {
        // For this function, returning 'unknown' is acceptable behavior when not in a git repo
        // So we return the default value instead of throwing
        return 'unknown';
    }
}

export async function getBranchCount(cwd: string = process.cwd()): Promise<number> {
    try {
        const git = simpleGit(cwd);
        const branches = await git.branch(['-a']);
        return branches.all.length;
    } catch (error) {
        // For this function, returning 0 is acceptable behavior when not in a git repo
        // So we return the default value instead of throwing
        return 0;
    }
}

export async function getRepoRoot(cwd: string = process.cwd()): Promise<string> {
    try {
        const git = simpleGit(cwd);
        const root = await git.revparse(['--show-toplevel']);
        return root.trim();
    } catch {
        return cwd;
    }
}

export async function revertFile(filePath: string, cwd: string = process.cwd()): Promise<void> {
    const git = simpleGit(cwd);
    await git.checkout(['HEAD', '--', filePath]);
}

export async function isGitRepository(cwd: string = process.cwd()): Promise<boolean> {
    try {
        const git = simpleGit(cwd);
        await git.revparse(['--git-dir']);
        return true;
    } catch {
        return false;
    }
}

export async function deleteFile(
    filePath: string,
    cwd: string = process.cwd(),
    fsPromises: FsPromises = defaultFsPromises,
    path: Path = defaultPath
): Promise<void> {
    try {
        const absolutePath = path.resolve(cwd, filePath);
        await fsPromises.unlink(absolutePath);
    } catch (error) {
        // Silently handle the error as before
        return;
    }
}

export async function deleteFileSafely(
    filePath: string,
    cwd: string = process.cwd(),
    fsPromises: FsPromises = defaultFsPromises,
    path: Path = defaultPath
): Promise<boolean> {
    const absolutePath = path.resolve(cwd, filePath);

    try {
        await fsPromises.access(absolutePath);
    } catch {
        return false; // File doesn't exist
    }

    try {
        // Use trash package for cross-platform recycle bin functionality
        const { default: trash } = await import('trash');
        await trash([absolutePath]);

        // Wait a moment and verify file was actually deleted
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            await fsPromises.access(absolutePath);
        } catch {
            return true; // Successfully deleted
        }
        return false; // Still exists (delete failed)
    } catch (fallbackError) {
        // Fallback to permanent delete if trash fails
        try {
            await fsPromises.unlink(absolutePath);
            // Wait a moment and verify deletion
            await new Promise(resolve => setTimeout(resolve, 500));

            try {
                await fsPromises.access(absolutePath);
            } catch {
                return true; // Successfully deleted
            }
            return false; // Still exists (delete failed)
        } catch {
            return false;
        }
    }
}

export async function searchFiles(searchTerm: string, filesToSearch: FileStatus[], cwd: string = process.cwd()): Promise<FileStatus[]> {
    if (!searchTerm || !searchTerm.trim() || filesToSearch.length === 0) {
        return [];
    }

    // Sanitize and validate search term
    const trimmedTerm = searchTerm.trim();


    // Escape special characters that could be problematic in git grep
    // Although -F flag should treat as fixed string, extra validation is good
    const sanitizedTerm = trimmedTerm.replace(/[\\`$();|&<>{}[\]]/g, '');

    if (!sanitizedTerm) {
        return [];
    }

    try {
        const git = simpleGit(cwd);
        const root = await getRepoRoot(cwd);

        // Use git grep to search ONLY within the specified files
        const filePathArgs = filesToSearch.map(f => f.path);
        const grepArgs = ['grep', '-i', '-l', '-F', '--', sanitizedTerm, '--', ...filePathArgs];

        const result = await git.raw(grepArgs);
        const matchedPaths = new Set(result.split('\n').map(p => p.trim()).filter(p => p !== ''));

        if (matchedPaths.size === 0) {
            return [];
        }

        // Filter input files to only include those that matched
        return filesToSearch.filter(f => matchedPaths.has(f.path));
    } catch (e: any) {
        // git grep returns exit code 1 if no matches are found
        // In any case, if search fails we return empty results
        return [];
    }
}

export async function getRawDiff(filePath: string, cwd: string = process.cwd()): Promise<string> {
    try {
        const git = simpleGit(cwd);
        // Use -U3 for 3 lines of context, matching our previous logic
        const diff = await git.diff(['HEAD', '-U3', '--', filePath]);
        return diff;
    } catch (e) {
        // For diff operations, returning empty string is acceptable when file is not in git
        return '';
    }
}

export interface CommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}

export async function getCommitHistory(cwd: string = process.cwd(), limit?: number): Promise<CommitInfo[]> {
    try {
        const git = simpleGit(cwd);
        const options = limit ? { maxCount: limit } : {};
        const log = await git.log(options);
        return log.all.map(commit => ({
            hash: commit.hash.substring(0, 7),
            message: commit.message,
            author: commit.author_name,
            date: commit.date
        }));
    } catch (error) {
        // Return empty array if commit history cannot be loaded
        return [];
    }
}

export interface ChangedFile {
    path: string;
    status: string; // Use the exact status code from Git
}

export async function getFilesInCommit(commitHash: string, cwd: string = process.cwd()): Promise<ChangedFile[]> {
    try {
        const git = simpleGit(cwd);
        // Get the list of files changed in the specific commit using show command
        const result = await git.show(['--name-status', '--format=', commitHash]);

        const files: ChangedFile[] = [];

        // Parse the output - each line has format like "A    path/to/file" or "M    path/to/file"
        const lines = result.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const parts = trimmedLine.split(/\s+/);
                if (parts.length >= 2) {
                    const statusCode = parts[0];
                    const filePath = parts.slice(1).join(' ');

                    if (statusCode && filePath) { // Only add if both statusCode and filePath exist and are not empty
                        files.push({
                            path: filePath,
                            status: statusCode // Use the exact status code from Git
                        });
                    }
                }
            }
        }

        return files;
    } catch (error) {
        console.error(`Failed to get files for commit ${commitHash}:`, error);
        return [];
    }
}