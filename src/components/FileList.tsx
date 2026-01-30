import { useRef, useEffect } from 'react';
import { useRenderer } from '@opentui/react';
import { type FileStatus } from '../utils/git';

interface FileListProps {
    files: FileStatus[];
    selectedIndex: number;
    focused: boolean;
    searchQuery?: string;
    onSelect?: (index: number) => void;
    onScroll?: (delta: number) => void;
}

export function FileList({ files, selectedIndex, focused, searchQuery, onSelect, onScroll }: FileListProps) {
    const scrollRef = useRef<any>(null);
    const renderer = useRenderer();

    useEffect(() => {
        if (scrollRef.current) {
            const viewportHeight = scrollRef.current.viewport?.height || 10;
            const scrollTop = scrollRef.current.scrollTop;

            if (selectedIndex < scrollTop) {
                scrollRef.current.scrollTop = selectedIndex;
            } else if (selectedIndex >= scrollTop + viewportHeight) {
                scrollRef.current.scrollTop = selectedIndex - viewportHeight + 1;
            }
        }
    }, [selectedIndex]);

    // Calculate the max length for file paths based on available width
    // Account for the symbol, space, and padding
    const calculateMaxPathLength = (): number => {
        // Get the width of the container (33% of total width)
        // Since we can't directly measure the rendered width, we'll estimate based on a percentage
        // considering that the container is 33% of the total width
        // and we need to account for the symbol (1 char) + space (1 char) = 2 chars
        // Also account for potential borders and padding (approximately 2-3 chars)
        const estimatedWidth = Math.floor((renderer.width * 0.33) - 5); // 5 chars for symbol + spaces + borders/padding
        return Math.max(10, estimatedWidth); // minimum length of 10
    };

    const truncatePath = (path: string, maxLength: number): string => {
        if (path.length <= maxLength) {
            return path;
        }
        if (maxLength <= 3) {
            return '.'.repeat(maxLength);
        }
        return path.substring(0, maxLength - 3) + '...';
    };

    const maxPathLength = calculateMaxPathLength();

    const title = searchQuery
        ? ` Files (${files.length}) - "${searchQuery}" `
        : ` Files (${files.length}) `;

    return (
        <box
            border
            title={title}
            width="33%"
            height="100%"
            borderColor={focused ? 'yellow' : 'grey'}
            flexDirection="column"
        >
            <scrollbox
                flexGrow={1}
                ref={scrollRef}
                onMouseScroll={(e: any) => {
                    // OpenTUI MouseButton: WHEEL_UP = 4, WHEEL_DOWN = 5
                    const delta = e.button === 4 ? -1 : (e.button === 5 ? 1 : 0);
                    if (delta !== 0) onScroll?.(delta);
                }}
            >
                {files.map((file, i) => {
                    const isSelected = i === selectedIndex;
                    const colorMap: Record<string, string> = {
                        modified: 'yellow',
                        new: 'green',
                        deleted: 'brightRed',
                        renamed: 'blue',
                        unstaged: 'cyan',
                        unmerged: 'magenta',
                        ignored: 'grey',
                        unknown: 'white'
                    };

                    const color = colorMap[file.status] || 'white';
                    const symbolMap: Record<string, string> = {
                        modified: 'M',
                        new: 'A',
                        deleted: 'D',
                        renamed: 'R',
                        unstaged: 'M',
                        unmerged: 'U',
                        ignored: '!',
                        unknown: '?'
                    };
                    const symbol = symbolMap[file.status] || '?';

                    const truncatedPath = truncatePath(file.path, maxPathLength);

                    return (
                        <box
                            key={file.path}
                            height={1}
                            backgroundColor={isSelected ? 'white' : undefined}
                            onMouseDown={() => onSelect?.(i)}
                        >
                            <text
                                fg={isSelected ? 'black' : color}
                            >
                                {` ${symbol} ${truncatedPath}`}
                            </text>
                        </box>
                    );
                })}
            </scrollbox>
        </box>
    );
}
