import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import App from './App';
import { isGitRepository } from './utils/git';
import { BUILD_VERSION } from './version';

function getVersion(): string {
    return BUILD_VERSION || 'unknown';
}

function showHelp(): void {
    const version = getVersion();
    console.log(`DiffWatch v${version}\n`);
    console.log('A TUI app for watching git repository file changes with diffs.\n');
    console.log('USAGE:');
    console.log('  diffwatch [OPTIONS]\n');
    console.log('OPTIONS:');
    console.log('  --path <path>    Specify git repository path to watch');
    console.log('  -p <path>        Same as --path');
    console.log('  --help, -h       Show this help message');
    console.log('  --version, -v    Show version number\n');
    console.log('KEYBOARD SHORTCUTS:');
    console.log('  ↑/↓              Navigate file list');
    console.log('  Tab/←/→          Switch between file list and diff view');
    console.log('  Enter            Open selected file in default editor');
    console.log('  D                Delete selected file');
    console.log('  R                Revert changes to selected file');
    console.log('  S                Enter search mode');
    console.log('  H                View commit history');
    console.log('  Q                Quit application\n');
    console.log('For more information, visit https://github.com/sarfraznawaz2005/diffwatch');
    process.exit(0);
}

function showVersion(): void {
    const version = getVersion();
    console.log(`DiffWatch v${version}`);
    process.exit(0);
}

function parseArgs(): { path?: string } {
    const args = process.argv.slice(2);
    const result: { path?: string } = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            showHelp();
        } else if (arg === '--version' || arg === '-v') {
            showVersion();
        } else if (arg === '--path' || arg === '-p') {
            if (i + 1 < args.length) {
                result.path = args[i + 1];
                i++;
            } else {
                console.error('Error: --path requires a path argument');
                process.exit(1);
            }
        } else {
            console.error(`Error: Unknown option '${arg}'`);
            console.error('Use --help for usage information');
            process.exit(1);
        }
    }

    return result;
}

async function main() {
    const { path: customPath } = parseArgs();

    if (customPath) {
        try {
            process.chdir(customPath);
        } catch (error) {
            console.error(`Error: Invalid path '${customPath}'`);
            console.error('The specified directory does not exist.');
            process.exit(1);
        }
    }

    // Check if current directory is a git repository BEFORE creating renderer
    const isGitRepo = await isGitRepository();

    if (!isGitRepo) {
        const pathInfo = customPath ? `\nSpecified path: ${customPath}` : '';
        const errorMessage = [
            'Error: Not a git repository',
            '',
            'Please run this application from within a git repository.',
            pathInfo
        ].filter(Boolean).join('\n') + '\n';

        console.error(errorMessage);
        process.exit(1);
    }

    // Set terminal title
    process.stdout.write(`\x1b]0;DiffWatch\x07`);

    const renderer = await createCliRenderer();
    const root = createRoot(renderer);

    root.render(<App />);
}

main().catch(console.error);

