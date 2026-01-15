import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import fs from 'fs/promises';

export interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'unstaged' | 'unknown';
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

  async getDiff(filePath: string): Promise<string> {
    try {
      const isUntracked = (await this.git.status()).not_added.includes(filePath);
      
      if (isUntracked) {
        return await this.git.raw(['diff', '--no-index', '--', '/dev/null', filePath]).catch(() => {
          return `New file: ${filePath}`;
        });
      }

      const diff = await this.git.diff(['HEAD', '--', filePath]);
      return diff || 'No changes or file is new.';
    } catch (error) {
      return `Error getting diff: ${error}`;
    }
  }
}
