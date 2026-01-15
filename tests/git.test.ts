jest.mock('simple-git', () => ({
  simpleGit: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
}));

import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import { GitHandler } from '../src/utils/git';

describe('GitHandler', () => {
  let gitHandler: GitHandler;
  let mockGit: any;

  beforeEach(() => {
    mockGit = {
      checkIsRepo: jest.fn(),
      status: jest.fn(),
      diff: jest.fn(),
      show: jest.fn(),
    };
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    (fs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });
    gitHandler = new GitHandler();
  });

  it('should return true if directory is a repo', async () => {
    mockGit.checkIsRepo.mockResolvedValue(true);
    const result = await gitHandler.isRepo();
    expect(result).toBe(true);
  });

  it('should return false if directory is not a repo', async () => {
    mockGit.checkIsRepo.mockRejectedValue(new Error('not a repo'));
    const result = await gitHandler.isRepo();
    expect(result).toBe(false);
  });

  it('should return file status correctly', async () => {
    mockGit.status.mockResolvedValue({
      modified: ['file1.ts'],
      deleted: ['file2.ts'],
      created: ['file3.ts'],
      not_added: ['file4.ts'],
      renamed: [],
    });

    const status = await gitHandler.getStatus();
    expect(status).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'file1.ts', status: 'modified' }),
      expect.objectContaining({ path: 'file2.ts', status: 'deleted' }),
      expect.objectContaining({ path: 'file3.ts', status: 'added' }),
      expect.objectContaining({ path: 'file4.ts', status: 'unstaged' }),
    ]));
  });

  it('should return diff correctly', async () => {
    mockGit.status.mockResolvedValue({ not_added: [] });
    mockGit.diff.mockResolvedValue('+ added line\n- removed line');
    const diff = await gitHandler.getDiff('file1.ts');
    expect(diff).toBe('+ added line\n- removed line');
  });

  it('should sort files by last modified descending then filename', async () => {
    // Mock fs.stat to return different mtimes
    const mockStat = jest.fn();
    (fs.stat as jest.Mock) = mockStat;
    mockStat.mockImplementation((path: string) => {
      const mtimes: Record<string, Date> = {
        'z-file.ts': new Date('2024-01-03'),
        'a-file.ts': new Date('2024-01-01'),
        'z-deleted.ts': new Date('2024-01-02'),
        'z-added.ts': new Date('2024-01-04'),
        'a-added.ts': new Date('2024-01-05'),
        'z-unstaged.ts': new Date('2024-01-06'),
        'a-unstaged.ts': new Date('2024-01-07'),
      };
      return Promise.resolve({ mtime: mtimes[path] || new Date(0) });
    });

    mockGit.status.mockResolvedValue({
      modified: ['z-file.ts', 'a-file.ts'],
      deleted: ['z-deleted.ts'],
      created: ['z-added.ts', 'a-added.ts'],
      not_added: ['z-unstaged.ts', 'a-unstaged.ts'],
      renamed: [],
    });

    const status = await gitHandler.getStatus();
    expect(status.map(f => f.path)).toEqual([
      'a-unstaged.ts', // newest
      'z-unstaged.ts',
      'a-added.ts',
      'z-added.ts',
      'z-file.ts',
      'z-deleted.ts',
      'a-file.ts', // oldest
    ]);
  });
});
