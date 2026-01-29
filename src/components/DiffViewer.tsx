import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useKeyboard } from '@opentui/react';
import { getRawDiff } from '../utils/git';
import * as Diff2Html from 'diff2html';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { POLLING_INTERVAL } from '../constants';
import { isBinaryFile } from 'isbinaryfile';

interface DiffViewerProps {
    filename?: string;
    focused: boolean;
    searchQuery?: string;
    status?: 'modified' | 'new' | 'deleted' | 'renamed' | 'unknown' | 'unstaged' | 'unchanged' | 'ignored';
    repoPath?: string;
}

export function DiffViewer({ filename, focused, searchQuery, status, repoPath }: DiffViewerProps) {
    const [rawDiff, setRawDiff] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [isBinary, setIsBinary] = useState(false);
    const scrollRef = useRef<any>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const loadContent = async (showLoading = true) => {
        if (!filename) {
            setRawDiff('');
            setFileContent('');
            setIsBinary(false);
            return;
        }

        if (showLoading) setLoading(true);

        if (status === 'new' || status === 'unchanged') {
            try {
                const absPath = path.isAbsolute(filename) ? filename : path.join(repoPath || process.cwd(), filename);
                const content = await fsPromises.readFile(absPath, 'utf-8');
                const binary = await isBinaryFile(absPath);
                if (binary) {
                    setFileContent('');
                    setRawDiff('');
                    setIsBinary(true);
                } else {
                    setFileContent(content);
                    setRawDiff('');
                    setIsBinary(false);
                }
            } catch (e) {
                setFileContent('');
                setIsBinary(false);
            }
            if (showLoading) setLoading(false);
        } else {
            const diff = await getRawDiff(filename);
            setRawDiff(diff);
            setFileContent('');
            setIsBinary(false);
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        loadContent(true);
    }, [filename, status, repoPath]);

    useEffect(() => {
        if (!filename) return;

        // Clear any existing interval to prevent duplicates
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(async () => {
            await loadContent(false);
        }, POLLING_INTERVAL);

        // Cleanup function
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [filename, status, repoPath]);

const diffData = useMemo(() => {
        if (!rawDiff) return null;
        const parsed = Diff2Html.parse(rawDiff, {
            matching: 'lines'
        });
        return parsed[0] || null;
    }, [rawDiff]);

    useKeyboard((key) => {
        if (!focused || !scrollRef.current) return;

        if (key.name === 'up') {
            scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 1);
        } else if (key.name === 'down') {
            scrollRef.current.scrollTop = scrollRef.current.scrollTop + 1;
        } else if (key.name === 'pageup') {
            scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 10);
        } else if (key.name === 'pagedown') {
            scrollRef.current.scrollTop = scrollRef.current.scrollTop + 10;
        }
    });

    const hasChanges = diffData && diffData.blocks.length > 0;
    const isNewFile = status === 'new';
    const contentLines = useMemo(() => {
        if (!fileContent) return [];
        return fileContent.split('\n');
    }, [fileContent]);

    // Soft wrap lines at approximately 80 characters
    const MAX_LINE_WIDTH = 80;

    const wrapLine = (text: string, maxLength: number): string[] => {
        if (text.length <= maxLength) return [text];

        const lines: string[] = [];
        let remaining = text;

        while (remaining.length > 0) {
            if (remaining.length <= maxLength) {
                lines.push(remaining);
                break;
            }

            // Find best break point (prefer spaces)
            let breakIndex = maxLength;
            const lastSpace = remaining.lastIndexOf(' ', maxLength);

            if (lastSpace > maxLength * 0.5) {
                breakIndex = lastSpace + 1;
            }

            lines.push(remaining.substring(0, breakIndex));
            remaining = remaining.substring(breakIndex);
        }

        return lines;
    };

    return (
        <box
            border
            title={` Diff (${filename || 'None'}) `}
            width="70%"
            borderColor={focused ? 'yellow' : 'grey'}
            flexDirection="column"
        >
            {loading ? (
                <text>Loading diff...</text>
            ) : !filename ? (
                <text>Select a file to view changes.</text>
            ) : isBinary ? (
                <text fg="gray">Binary file - content not displayed.</text>
            ) : isNewFile ? (
                <scrollbox flexGrow={1} ref={scrollRef}>
                    {contentLines.flatMap((line, i) => {
                        const wrappedLines = wrapLine(line, MAX_LINE_WIDTH);

                        return wrappedLines.map((wrappedLine, wrapIdx) => {
                            const isFirstLine = wrapIdx === 0;
                            let renderedParts: React.ReactNode = wrappedLine;

                            if (searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase())) {
                                // Sanitize search query for regex to prevent ReDoS attacks
                                const sanitizedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const parts = wrappedLine.split(new RegExp(`(${sanitizedQuery})`, 'gi'));
                                renderedParts = parts.map((part, idx) =>
                                    part.toLowerCase() === searchQuery.toLowerCase()
                                        ? <span key={idx} fg="black" bg="yellow">{part}</span>
                                        : part
                                );
                            }

                            return (
                                <box key={`${i}-${wrapIdx}`} flexDirection="row" height={1}>
                                    {isFirstLine ? (
                                        <text fg="gray" width={6}>{`${String(i + 1).padStart(4)}: `}</text>
                                    ) : (
                                        <text fg="gray" width={6}>      </text>
                                    )}
                                    <text fg="green" flexGrow={1}>
                                        {renderedParts}
                                    </text>
                                </box>
                            );
                        });
                    })}
                </scrollbox>
            ) : !hasChanges ? (
                <text fg="gray">No changes detected.</text>
            ) : (
                <scrollbox flexGrow={1} ref={scrollRef}>
                    {diffData.blocks.map((block, bIdx) => (
                        <box key={bIdx} flexDirection="column" marginBottom={1}>
                            <text fg="cyan">{`      ${block.header}`}</text>
                            <text fg="cyan">{` ${block.header}`}</text>
                            {block.lines.map((line, lIdx) => {
                                let fg = 'white';
                                let prefix = ' ';
                                if (line.type === 'insert') { fg = 'green'; prefix = '+'; }
                                else if (line.type === 'delete') { fg = 'brightRed'; prefix = '-'; }

                                const ln = line.type === 'insert' ? line.newNumber : line.oldNumber;
                                const content = line.content.substring(1);

                                const lnText = ln ? `${String(ln).padStart(4)}: ` : '      ';

                                // Wrap content if it's too long
                                const wrappedContent = wrapLine(content, MAX_LINE_WIDTH);

                                return (
                                    <>
                                        {wrappedContent.map((wrappedLine, wrapIdx) => {
                                            const isFirstLine = wrapIdx === 0;

                                            let renderedParts: React.ReactNode;
                                            if (searchQuery && content.toLowerCase().includes(searchQuery.toLowerCase())) {
                                                // Sanitize search query for regex to prevent ReDoS attacks
                                                const sanitizedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                const parts = wrappedLine.split(new RegExp(`(${sanitizedQuery})`, 'gi'));
                                                renderedParts = parts.map((part, i) =>
                                                    part.toLowerCase() === searchQuery.toLowerCase()
                                                        ? <span key={i} fg="black" bg="yellow">{part}</span>
                                                        : part
                                                );
                                            } else {
                                                renderedParts = wrappedLine;
                                            }

                                            return (
                                                <box key={`${bIdx}-${lIdx}-${wrapIdx}`} flexDirection="row" height={1}>
                                                    <text fg="gray" width={lnText.length}>
                                                        {isFirstLine ? lnText : '      '}
                                                    </text>
                                                    <text fg={fg} flexGrow={1}>
                                                        {isFirstLine ? `${prefix}${renderedParts}` : ` ${renderedParts}`}
                                                    </text>
                                                </box>
                                            );
                                        })}
                                    </>
                                );
                            })}
                        </box>
                    ))}
                </scrollbox>
            )}
        </box>
    );
}
