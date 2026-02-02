interface StatusBarProps {
    branch: string;
    branchCount: number;
    fileCount: number;
    searchActive?: boolean;
}

export function StatusBar({ branch, branchCount, fileCount, searchActive = false }: StatusBarProps) {
    // Show file-related options if either there are files OR search is active
    const showFileOptions = fileCount > 0 || searchActive;
    return (
        <box height={1} flexDirection="row" justifyContent="space-between">
            <text>
                <span fg="brightGreen">←→</span> Switch
                {showFileOptions && (
                    <>
                        {' '}| <span fg="brightGreen">⏎</span> Open | <span fg="brightGreen">S</span> Search | <span fg="brightGreen">R</span> Revert | <span fg="brightGreen">D</span> Delete
                    </>
                )}
                {' '}| <span fg="brightGreen">H</span> History | <span fg="brightGreen">Q</span> Quit
            </text>
            <text>
                <span fg="cyan">Branch:</span> <span fg="yellow">{branch}</span> <span fg="gray">({branchCount})</span>
            </text>
        </box>
    );
}
