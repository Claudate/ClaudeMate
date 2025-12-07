/**
 * Node Configuration Dialog
 * Edit node properties in a modal dialog
 */

import { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import type {
  NodeConfig,
  ClaudeNodeConfig,
  FileSystemNodeConfig,
  TransformNodeConfig,
  ConditionNodeConfig,
  InputNodeConfig,
  OutputNodeConfig,
} from '../../../../main/workflow/types';

interface NodeConfigDialogProps {
  node: Node | null;
  onSave: (nodeId: string, config: NodeConfig, label: string) => void;
  onClose: () => void;
}

export default function NodeConfigDialog({ node, onSave, onClose }: NodeConfigDialogProps) {
  const [config, setConfig] = useState<NodeConfig | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (node) {
      setConfig(node.data.config);
      setLabel(node.data.label || '');
    }
  }, [node]);

  if (!node || !config) return null;

  const handleSave = () => {
    if (config) {
      onSave(node.id, config, label);
    }
  };

  const renderConfigForm = () => {
    switch (config.type) {
      case 'claude':
        return <ClaudeConfigForm config={config} setConfig={setConfig} />;
      case 'filesystem':
        return <FileSystemConfigForm config={config} setConfig={setConfig} />;
      case 'transform':
        return <TransformConfigForm config={config} setConfig={setConfig} />;
      case 'condition':
        return <ConditionConfigForm config={config} setConfig={setConfig} />;
      case 'input':
        return <InputConfigForm config={config} setConfig={setConfig} />;
      case 'output':
        return <OutputConfigForm config={config} setConfig={setConfig} />;
      default:
        return <div>Unknown node type</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="vscode-panel w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-vscode-border">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <i className="codicon codicon-settings-gear text-vscode-accent" />
              Configure {node.type} Node
            </h2>
            <p className="text-xs text-vscode-foreground-dim mt-1">ID: {node.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-vscode-foreground-dim hover:text-vscode-foreground"
          >
            <i className="codicon codicon-close text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Node Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="vscode-input w-full"
              placeholder="Enter node label"
            />
          </div>

          {/* Node-specific config */}
          {renderConfigForm()}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-vscode-border">
          <button onClick={onClose} className="vscode-button-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="vscode-button">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== Claude AI Config Form ==========
function ClaudeConfigForm({
  config,
  setConfig,
}: {
  config: ClaudeNodeConfig;
  setConfig: (config: NodeConfig) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Prompt <span className="text-red-400">*</span>
        </label>
        <textarea
          value={config.prompt}
          onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
          className="vscode-input w-full min-h-[120px] font-mono text-sm"
          placeholder="Enter your prompt here. Use {{variableName}} for variable substitution."
        />
        <p className="text-xs text-vscode-foreground-dim mt-1">
          Tip: Use {`{{variableName}}`} to insert variables
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Model</label>
        <select
          value={config.model || 'sonnet'}
          onChange={(e) => setConfig({ ...config, model: e.target.value as any })}
          className="vscode-input w-full"
        >
          <option value="opus">Claude Opus (最强)</option>
          <option value="sonnet">Claude Sonnet (平衡)</option>
          <option value="haiku">Claude Haiku (最快)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Output Variable
        </label>
        <input
          type="text"
          value={config.outputVariable || ''}
          onChange={(e) => setConfig({ ...config, outputVariable: e.target.value })}
          className="vscode-input w-full"
          placeholder="response"
        />
        <p className="text-xs text-vscode-foreground-dim mt-1">
          Variable name to store Claude's response
        </p>
      </div>
    </>
  );
}

// ========== File System Config Form ==========
function FileSystemConfigForm({
  config,
  setConfig,
}: {
  config: FileSystemNodeConfig;
  setConfig: (config: NodeConfig) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Action <span className="text-red-400">*</span>
        </label>
        <select
          value={config.action}
          onChange={(e) => setConfig({ ...config, action: e.target.value as any })}
          className="vscode-input w-full"
        >
          <option value="read">Read File</option>
          <option value="write">Write File</option>
          <option value="list">List Directory</option>
          <option value="delete">Delete File</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          File Path <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={config.path}
          onChange={(e) => setConfig({ ...config, path: e.target.value })}
          className="vscode-input w-full font-mono text-sm"
          placeholder="/path/to/file or {{pathVariable}}"
        />
        <p className="text-xs text-vscode-foreground-dim mt-1">
          Supports variable substitution: {`{{variableName}}`}
        </p>
      </div>

      {config.action === 'write' && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Content <span className="text-red-400">*</span>
          </label>
          <textarea
            value={config.content || ''}
            onChange={(e) => setConfig({ ...config, content: e.target.value })}
            className="vscode-input w-full min-h-[100px] font-mono text-sm"
            placeholder="File content or {{contentVariable}}"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Output Variable
        </label>
        <input
          type="text"
          value={config.outputVariable || ''}
          onChange={(e) => setConfig({ ...config, outputVariable: e.target.value })}
          className="vscode-input w-full"
          placeholder="fileContent"
        />
      </div>
    </>
  );
}

// ========== Transform Config Form ==========
function TransformConfigForm({
  config,
  setConfig,
}: {
  config: TransformNodeConfig;
  setConfig: (config: NodeConfig) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Operation <span className="text-red-400">*</span>
        </label>
        <select
          value={config.operation}
          onChange={(e) => setConfig({ ...config, operation: e.target.value as any })}
          className="vscode-input w-full"
        >
          <option value="concat">Concatenate</option>
          <option value="extract">Extract</option>
          <option value="format">Format as JSON</option>
          <option value="custom">Custom Expression</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Input Variables <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={config.inputs.join(', ')}
          onChange={(e) =>
            setConfig({
              ...config,
              inputs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          className="vscode-input w-full"
          placeholder="var1, var2, var3"
        />
        <p className="text-xs text-vscode-foreground-dim mt-1">
          Comma-separated variable names
        </p>
      </div>

      {config.operation === 'custom' && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Custom Expression <span className="text-red-400">*</span>
          </label>
          <textarea
            value={config.expression || ''}
            onChange={(e) => setConfig({ ...config, expression: e.target.value })}
            className="vscode-input w-full min-h-[80px] font-mono text-sm"
            placeholder="var1 + ' - ' + var2"
          />
          <p className="text-xs text-vscode-foreground-dim mt-1">
            JavaScript expression using input variables
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Output Variable
        </label>
        <input
          type="text"
          value={config.outputVariable || ''}
          onChange={(e) => setConfig({ ...config, outputVariable: e.target.value })}
          className="vscode-input w-full"
          placeholder="transformedValue"
        />
      </div>
    </>
  );
}

// ========== Condition Config Form ==========
function ConditionConfigForm({
  config,
  setConfig,
}: {
  config: ConditionNodeConfig;
  setConfig: (config: NodeConfig) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Condition Expression <span className="text-red-400">*</span>
        </label>
        <textarea
          value={config.condition}
          onChange={(e) => setConfig({ ...config, condition: e.target.value })}
          className="vscode-input w-full min-h-[80px] font-mono text-sm"
          placeholder="value > 0 && status === 'active'"
        />
        <p className="text-xs text-vscode-foreground-dim mt-1">
          JavaScript expression that returns true/false
        </p>
      </div>

      <div className="p-3 bg-vscode-editor-bg rounded border border-vscode-border">
        <div className="text-sm font-medium mb-2">Available Variables:</div>
        <div className="text-xs text-vscode-foreground-dim">
          All workflow variables are available in the condition expression.
        </div>
      </div>
    </>
  );
}

// ========== Input Config Form ==========
function InputConfigForm({
  config,
  setConfig,
}: {
  config: InputNodeConfig;
  setConfig: (config: NodeConfig) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Variable Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={config.variableName}
          onChange={(e) => setConfig({ ...config, variableName: e.target.value })}
          className="vscode-input w-full"
          placeholder="inputVar"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Variable Type
        </label>
        <select
          value={config.variableType}
          onChange={(e) => setConfig({ ...config, variableType: e.target.value as any })}
          className="vscode-input w-full"
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="file">File Path</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Default Value
        </label>
        <input
          type="text"
          value={config.defaultValue || ''}
          onChange={(e) => setConfig({ ...config, defaultValue: e.target.value })}
          className="vscode-input w-full"
          placeholder="Default value if not provided"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          value={config.description || ''}
          onChange={(e) => setConfig({ ...config, description: e.target.value })}
          className="vscode-input w-full min-h-[60px]"
          placeholder="Describe this input variable"
        />
      </div>
    </>
  );
}

// ========== Output Config Form ==========
function OutputConfigForm({
  config,
  setConfig,
}: {
  config: OutputNodeConfig;
  setConfig: (config: NodeConfig) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">
          Variable Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={config.variableName}
          onChange={(e) => setConfig({ ...config, variableName: e.target.value })}
          className="vscode-input w-full"
          placeholder="outputVar"
        />
        <p className="text-xs text-vscode-foreground-dim mt-1">
          Which variable to output
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Output Format
        </label>
        <select
          value={config.format || 'text'}
          onChange={(e) => setConfig({ ...config, format: e.target.value as any })}
          className="vscode-input w-full"
        >
          <option value="text">Plain Text</option>
          <option value="json">JSON</option>
          <option value="file">File</option>
        </select>
      </div>
    </>
  );
}
