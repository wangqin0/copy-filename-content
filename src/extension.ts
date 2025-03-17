import * as vscode from 'vscode';
import * as path from 'path';

// Get exclusion patterns from settings or use defaults
function getExclusionPatterns(): string[] {
    const config = vscode.workspace.getConfiguration('copy-filename-content');
    const userPatterns = config.get<string[]>('excludePatterns', []);
    
    // Default patterns for common build directories
    const defaultPatterns = [
        'node_modules',
        'dist',
        'build',
        'bin',
        'obj',
        'target',
        '.git',
        '.vs',
        '.idea',
        'out',
        'intermediate',
        '__pycache__',
        'venv',
        '.venv',
        '.next',
        'Debug',
        'Release',
    ];
    
    return [...defaultPatterns, ...userPatterns];
}

// Check if a path should be excluded
function shouldExclude(name: string, patterns: string[]): boolean {
    return patterns.some(pattern => 
        name === pattern || 
        name.startsWith(`${pattern}/`) || 
        name.startsWith(`${pattern}\\`)
    );
}

async function isBinaryFile(uri: vscode.Uri): Promise<boolean> {
    try {
        const buffer = await vscode.workspace.fs.readFile(uri);
        const sampleSize = Math.min(8192, buffer.length);
        for (let i = 0; i < sampleSize; i++) {
            if (buffer[i] === 0) return true;
        }
        return false;
    } catch {
        return true;
    }
}

async function getDirectoryTree(uri: vscode.Uri, prefix = '', excludePatterns?: string[]): Promise<string> {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    let tree = '';
    
    // Get exclusion patterns if not provided
    if (!excludePatterns) {
        excludePatterns = getExclusionPatterns();
    }

    for (const [name, type] of entries) {
        // Skip if this path should be excluded
        if (type === vscode.FileType.Directory && shouldExclude(name, excludePatterns)) {
            continue;
        }
        
        const childUri = vscode.Uri.joinPath(uri, name);
        
        if (type === vscode.FileType.Directory) {
            tree += `${prefix}📁 ${name}/\n`;
            tree += await getDirectoryTree(childUri, `${prefix}  `, excludePatterns);
        } else if (type === vscode.FileType.File) {
            tree += `${prefix}📄 ${name}\n`;
        }
    }
    return tree;
}

async function getFileView(uri: vscode.Uri): Promise<string | null> {
    if (await isBinaryFile(uri)) {
        return null;
    }

    try {
        const content = await vscode.workspace.fs.readFile(uri);
        const fileName = path.basename(uri.path);
        return `${fileName}\n\`\`\`\n${Buffer.from(content).toString('utf8')}\n\`\`\`\n\n`;
    } catch {
        return null;
    }
}

async function processDirectory(uri: vscode.Uri): Promise<string> {
    const excludePatterns = getExclusionPatterns();
    let output = `Directory Tree:\n${await getDirectoryTree(uri, '', excludePatterns)}\n\nFile Contents:\n`;
    
    async function processItem(itemUri: vscode.Uri): Promise<void> {
        const stat = await vscode.workspace.fs.stat(itemUri);
        const name = path.basename(itemUri.path);
        
        if (stat.type === vscode.FileType.Directory) {
            // Skip excluded directories
            if (shouldExclude(name, excludePatterns)) {
                return;
            }
            
            const entries = await vscode.workspace.fs.readDirectory(itemUri);
            for (const [childName] of entries) {
                await processItem(vscode.Uri.joinPath(itemUri, childName));
            }
        } else if (stat.type === vscode.FileType.File) {
            const fileView = await getFileView(itemUri);
            if (fileView) {
                output += fileView;
            }
        }
    }

    await processItem(uri);
    return output;
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'copy-filename-content.copy',
        async (uri: vscode.Uri) => {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                
                let content: string;
                if (stat.type === vscode.FileType.Directory) {
                    content = await processDirectory(uri);
                } else {
                    const fileView = await getFileView(uri);
                    if (!fileView) {
                        throw new Error('Binary or unreadable file');
                    }
                    content = fileView;
                }

                await vscode.env.clipboard.writeText(content);
                vscode.window.showInformationMessage(
                    `Copied ${stat.type === vscode.FileType.Directory ? 'directory' : 'file'} content to clipboard!`
                );
            } catch (error: any) {
                vscode.window.showErrorMessage(
                    `Failed to copy content: ${error.message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}
