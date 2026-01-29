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
                <span fg="green">←→</span> Switch
                {showFileOptions && (
                    <>
                        {' '}| <span fg="green">⏎</span> Open | <span fg="green">S</span> Search | <span fg="green">R</span> Revert | <span fg="green">D</span> Delete
                    </>
                )}
                {' '}| <span fg="green">H</span> History | <span fg="green">Q</span> Quit
            </text>
            <text>
                <span fg="cyan">Branch:</span> <span fg="yellow">{branch}</span> <span fg="gray">({branchCount} total)</span>
            </text>
        </box>
    );
}
