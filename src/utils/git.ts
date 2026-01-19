import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import fs from 'fs/promises';

export interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'unstaged' | 'unknown' | 'unchanged';
  mtime?: Date;
}

export class GitHandler {
  private git: SimpleGit;

  constructor(workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir);
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<FileStatus[]> {
    const status: StatusResult = await this.git.status();
    const files: FileStatus[] = [];

    status.modified.forEach(path => {
      files.push({ path, status: 'modified' });
    });

    status.deleted.forEach(path => {
      files.push({ path, status: 'deleted' });
    });

    status.created.forEach(path => {
      files.push({ path, status: 'added' });
    });

    status.not_added.forEach(path => {
      files.push({ path, status: 'unstaged' });
    });

    status.renamed.forEach(r => {
      files.push({ path: r.to, status: 'added' });
    });

    const uniqueFiles = new Map<string, FileStatus>();
    files.forEach(f => uniqueFiles.set(f.path, f));

    // Add last modified time for sorting
    const fileArray = Array.from(uniqueFiles.values());
    await Promise.all(fileArray.map(async (f) => {
      try {
        const stat = await fs.stat(f.path);
        f.mtime = stat.mtime;
      } catch (error) {
        // For deleted or inaccessible files, use epoch time
        f.mtime = new Date(0);
      }
    }));

    // Sort by last modified descending, then by filename
    return fileArray.sort((a, b) => {
      const mtimeA = a.mtime || new Date(0);
      const mtimeB = b.mtime || new Date(0);
      const timeDiff = mtimeB.getTime() - mtimeA.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.path.localeCompare(b.path);
    });
  }

  async searchFiles(term: string): Promise<FileStatus[]> {
    if (!term || !term.trim()) return [];

    try {
      // Use git grep to find files containing the term
      // -i: ignore case
      // -l: list filenames only
      // -F: interpret pattern as a fixed string
      // --untracked: include untracked files
      const result = await this.git.raw(['grep', '-i', '-l', '-F', '--untracked', term.trim()]);
      const matchedPaths = [...new Set(result.split('\n').map(p => p.trim()).filter(p => p !== ''))];
      
      if (matchedPaths.length === 0) return [];

      // Get current status to identify which matched files are changed
      const changedFiles = await this.getStatus();
      const changedMap = new Map<string, FileStatus>();
      changedFiles.forEach(f => changedMap.set(f.path, f));

      const finalResults: FileStatus[] = [];
      
      for (const path of matchedPaths) {
        if (changedMap.has(path)) {
          finalResults.push(changedMap.get(path)!);
        } else {
          // It's an unchanged file
          let mtime = new Date(0);
          try {
            const stat = await fs.stat(path);
            mtime = stat.mtime;
          } catch {}
          
          finalResults.push({
            path,
            status: 'unchanged',
            mtime
          });
        }
      }

      // Sort results by mtime descending
      return finalResults.sort((a, b) => {
        const mtimeA = a.mtime || new Date(0);
        const mtimeB = b.mtime || new Date(0);
        const timeDiff = mtimeB.getTime() - mtimeA.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.path.localeCompare(b.path);
      });
    } catch (error: any) {
      // git grep returns exit code 1 if no matches are found, which simple-git might throw as an error
      if (error.message && (error.message.includes('exit code 1') || error.exitCode === 1)) {
        return [];
      }
      throw error;
    }
  }

  async getDiff(filePath: string): Promise<string> {
    try {
      const isUntracked = (await this.git.status()).not_added.includes(filePath);
      
      if (isUntracked) {
        return await this.git.raw(['diff', '--no-index', '--', '/dev/null', filePath]).catch(() => {
          return `New file: ${filePath}`;
        });
      }

      const diff = await this.git.diff(['HEAD', '--', filePath]);
      return diff || '';
    } catch (error) {
      return `Error getting diff: ${error}`;
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      return `Error reading file: ${error}`;
    }
  }

  async revertFile(filePath: string): Promise<void> {
    try {
      // Restore the specific file to HEAD version
      await this.git.raw(['restore', filePath]);
    } catch (error) {
      throw new Error(`Could not revert file: ${error}`);
    }
  }
}
