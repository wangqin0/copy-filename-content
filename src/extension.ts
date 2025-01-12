import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  // Register the command
  const disposable = vscode.commands.registerCommand('copy-filename-content.copy', async (fileUri: vscode.Uri) => {
    try {
      // fileUri is the URI of the clicked file in the Explorer
      const filePath = fileUri.fsPath;
      const fileName = path.basename(filePath);

      // Read file content
      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Format text to copy
      const textToCopy = [
        fileName,
        '```',
        fileContent,
        '```'
      ].join('\n');

      // Copy to clipboard
      await vscode.env.clipboard.writeText(textToCopy);

      // Show a confirmation message
      vscode.window.showInformationMessage(`Copied content of "${fileName}" to clipboard!`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to copy file content: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
