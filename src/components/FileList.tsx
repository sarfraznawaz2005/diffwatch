import { useRef, useEffect } from 'react';
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

    const title = searchQuery
        ? ` Files (${files.length}) - "${searchQuery}" `
        : ` Files (${files.length}) `;

    return (
        <box
            border
            title={title}
            width="30%"
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
                                {` ${symbol} ${file.path}`}
                            </text>
                        </box>
                    );
                })}
            </scrollbox>
        </box>
    );
}
