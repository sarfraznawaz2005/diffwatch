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

  async searchFiles(files: FileStatus[], term: string): Promise<FileStatus[]> {
    if (!term || !term.trim()) return files;

    const results: FileStatus[] = [];
    
    // Process files in parallel for better performance
    await Promise.all(files.map(async (file) => {
      // Skip deleted files as they don't have content to search
      if (file.status === 'deleted') return;

      try {
        const content = await fs.readFile(file.path, 'utf8');
        if (content.toLowerCase().includes(term.toLowerCase())) {
          results.push(file);
        }
      } catch (error) {
        // Ignore errors (e.g., file not found, permission issues)
      }
    }));

    // Maintain original order (or close to it, but we filtered the list so strict order might need re-sorting if important, 
    // but the original list was sorted. The results array will be populated out of order due to Promise.all.
    // So we should re-sort or filter the original list based on results.)
    
    const matchedPaths = new Set(results.map(r => r.path));
    return files.filter(f => matchedPaths.has(f.path));
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
