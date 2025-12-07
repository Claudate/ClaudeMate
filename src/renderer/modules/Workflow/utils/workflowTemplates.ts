/**
 * Workflow Templates - Pre-configured skill workflows
 * 预定义的工作流模板，自动创建已连线的 skill 组合
 */

import { nanoid } from 'nanoid';
import type { WorkflowDefinition } from '../../../../main/workflow/types';

/**
 * 代码分析工作流模板
 * 读取代码 → Claude 分析 → 生成文档 → 保存结果
 */
export function createCodeAnalysisWorkflow(): WorkflowDefinition {
  const nodeIds = {
    input1: nanoid(),
    input2: nanoid(),
    readFile: nanoid(),
    analyze: nanoid(),
    writeDoc: nanoid(),
    output: nanoid(),
  };

  return {
    id: nanoid(),
    name: '代码分析与文档生成',
    description: '自动读取代码文件，使用 Claude AI 进行分析，并生成技术文档',
    category: 'coding',
    tags: ['analysis', 'documentation', 'automation'],
    nodes: [
      // 输入节点1：代码文件路径
      {
        id: nodeIds.input1,
        type: 'input',
        position: { x: 100, y: 150 },
        data: {
          label: '代码文件路径',
          config: {
            type: 'input',
            variableName: 'codeFilePath',
            variableType: 'file',
            defaultValue: './src/example.ts',
            description: '要分析的代码文件路径',
          },
          status: 'idle',
        },
      },
      // 输入节点2：输出目录
      {
        id: nodeIds.input2,
        type: 'input',
        position: { x: 100, y: 300 },
        data: {
          label: '输出目录',
          config: {
            type: 'input',
            variableName: 'outputDir',
            variableType: 'string',
            defaultValue: './docs',
            description: '生成文档的保存目录',
          },
          status: 'idle',
        },
      },
      // Skill 1: 读取代码文件
      {
        id: nodeIds.readFile,
        type: 'filesystem',
        position: { x: 350, y: 225 },
        data: {
          label: '读取代码文件',
          config: {
            type: 'filesystem',
            action: 'read',
            path: '{{codeFilePath}}',
            outputVariable: 'codeContent',
          },
          status: 'idle',
        },
      },
      // Skill 2: Claude AI 分析
      {
        id: nodeIds.analyze,
        type: 'skill',
        position: { x: 600, y: 225 },
        data: {
          label: '代码分析',
          config: {
            type: 'skill',
            name: '代码分析',
            prompt: `请对以下代码进行详细分析，生成技术文档，包括：
1. 代码功能概述
2. 主要函数和类的说明
3. 依赖关系
4. 使用示例
5. 注意事项

代码内容：
\`\`\`
{{codeContent}}
\`\`\``,
            outputVariable: 'documentation',
          },
          status: 'idle',
        },
      },
      // Skill 3: 保存文档
      {
        id: nodeIds.writeDoc,
        type: 'filesystem',
        position: { x: 850, y: 225 },
        data: {
          label: '保存文档',
          config: {
            type: 'filesystem',
            action: 'write',
            path: '{{outputDir}}/analysis.md',
            content: '{{documentation}}',
            outputVariable: 'savedPath',
          },
          status: 'idle',
        },
      },
      // 输出节点
      {
        id: nodeIds.output,
        type: 'output',
        position: { x: 1100, y: 225 },
        data: {
          label: '输出结果',
          config: {
            type: 'output',
            variableName: 'documentation',
            format: 'text',
          },
          status: 'idle',
        },
      },
    ],
    edges: [
      {
        id: nanoid(),
        source: nodeIds.input1,
        target: nodeIds.readFile,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.input2,
        target: nodeIds.writeDoc,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.readFile,
        target: nodeIds.analyze,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.analyze,
        target: nodeIds.writeDoc,
        type: 'success',
      },
      {
        id: nanoid(),
        source: nodeIds.writeDoc,
        target: nodeIds.output,
        type: 'default',
      },
    ],
    variables: {
      codeFilePath: './src/example.ts',
      outputDir: './docs',
    },
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 文本处理工作流模板
 * 读取文本 → Claude 优化 → 条件判断 → 保存结果
 */
export function createTextProcessingWorkflow(): WorkflowDefinition {
  const nodeIds = {
    input: nanoid(),
    readText: nanoid(),
    process: nanoid(),
    condition: nanoid(),
    saveGood: nanoid(),
    saveNeedsFix: nanoid(),
    output: nanoid(),
  };

  return {
    id: nanoid(),
    name: '文本处理与优化',
    description: '读取文本，使用 Claude AI 优化内容，根据质量评分保存到不同位置',
    category: 'writing',
    tags: ['writing', 'optimization', 'automation'],
    nodes: [
      // 输入节点
      {
        id: nodeIds.input,
        type: 'input',
        position: { x: 100, y: 200 },
        data: {
          label: '文本文件路径',
          config: {
            type: 'input',
            variableName: 'textFilePath',
            variableType: 'file',
            defaultValue: './draft.txt',
            description: '要处理的文本文件',
          },
          status: 'idle',
        },
      },
      // Skill 1: 读取文本
      {
        id: nodeIds.readText,
        type: 'filesystem',
        position: { x: 300, y: 200 },
        data: {
          label: '读取文本',
          config: {
            type: 'filesystem',
            action: 'read',
            path: '{{textFilePath}}',
            outputVariable: 'originalText',
          },
          status: 'idle',
        },
      },
      // Skill 2: Claude 处理
      {
        id: nodeIds.process,
        type: 'skill',
        position: { x: 500, y: 200 },
        data: {
          label: '优化文本',
          config: {
            type: 'skill',
            name: '优化文本',
            prompt: `请优化以下文本的语法、流畅度和清晰度。保持原意不变，但提升表达质量。

在回复的最后，用以下格式给出质量评分：
QUALITY_SCORE: [0-100]

原文：
{{originalText}}`,
            outputVariable: 'processedText',
          },
          status: 'idle',
        },
      },
      // Skill 3: 条件判断
      {
        id: nodeIds.condition,
        type: 'condition',
        position: { x: 700, y: 200 },
        data: {
          label: '质量检查',
          config: {
            type: 'condition',
            condition: 'parseInt(processedText.match(/QUALITY_SCORE: (\\d+)/)?.[1] || 0) >= 80',
          },
          status: 'idle',
        },
      },
      // Skill 4a: 保存高质量文本
      {
        id: nodeIds.saveGood,
        type: 'filesystem',
        position: { x: 900, y: 100 },
        data: {
          label: '保存（高质量）',
          config: {
            type: 'filesystem',
            action: 'write',
            path: './output/high-quality.txt',
            content: '{{processedText}}',
            outputVariable: 'savedPathGood',
          },
          status: 'idle',
        },
      },
      // Skill 4b: 保存需改进文本
      {
        id: nodeIds.saveNeedsFix,
        type: 'filesystem',
        position: { x: 900, y: 300 },
        data: {
          label: '保存（待改进）',
          config: {
            type: 'filesystem',
            action: 'write',
            path: './output/needs-improvement.txt',
            content: '{{processedText}}',
            outputVariable: 'savedPathFix',
          },
          status: 'idle',
        },
      },
      // 输出节点
      {
        id: nodeIds.output,
        type: 'output',
        position: { x: 1100, y: 200 },
        data: {
          label: '输出结果',
          config: {
            type: 'output',
            variableName: 'processedText',
            format: 'text',
          },
          status: 'idle',
        },
      },
    ],
    edges: [
      {
        id: nanoid(),
        source: nodeIds.input,
        target: nodeIds.readText,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.readText,
        target: nodeIds.process,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.process,
        target: nodeIds.condition,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.condition,
        target: nodeIds.saveGood,
        label: 'true',
        type: 'success',
      },
      {
        id: nanoid(),
        source: nodeIds.condition,
        target: nodeIds.saveNeedsFix,
        label: 'false',
        type: 'error',
      },
      {
        id: nanoid(),
        source: nodeIds.saveGood,
        target: nodeIds.output,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.saveNeedsFix,
        target: nodeIds.output,
        type: 'default',
      },
    ],
    variables: {
      textFilePath: './draft.txt',
    },
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 数据分析工作流模板
 * 读取数据 → 转换格式 → Claude 分析 → 生成报告
 */
export function createDataAnalysisWorkflow(): WorkflowDefinition {
  const nodeIds = {
    input: nanoid(),
    readData: nanoid(),
    transform: nanoid(),
    analyze: nanoid(),
    writeReport: nanoid(),
    output: nanoid(),
  };

  return {
    id: nanoid(),
    name: '数据分析与报告生成',
    description: '读取数据文件，转换格式，使用 Claude AI 进行分析，生成可视化报告',
    category: 'analysis',
    tags: ['data', 'analysis', 'report'],
    nodes: [
      // 输入节点
      {
        id: nodeIds.input,
        type: 'input',
        position: { x: 100, y: 200 },
        data: {
          label: '数据文件路径',
          config: {
            type: 'input',
            variableName: 'dataFilePath',
            variableType: 'file',
            defaultValue: './data.json',
            description: '要分析的数据文件（JSON 格式）',
          },
          status: 'idle',
        },
      },
      // Skill 1: 读取数据
      {
        id: nodeIds.readData,
        type: 'filesystem',
        position: { x: 300, y: 200 },
        data: {
          label: '读取数据',
          config: {
            type: 'filesystem',
            action: 'read',
            path: '{{dataFilePath}}',
            outputVariable: 'rawData',
          },
          status: 'idle',
        },
      },
      // Skill 2: 转换数据
      {
        id: nodeIds.transform,
        type: 'transform',
        position: { x: 500, y: 200 },
        data: {
          label: '数据转换',
          config: {
            type: 'transform',
            operation: 'format',
            inputs: ['rawData'],
            expression: 'JSON.stringify(JSON.parse(rawData), null, 2)',
            outputVariable: 'formattedData',
          },
          status: 'idle',
        },
      },
      // Skill 3: Claude 分析
      {
        id: nodeIds.analyze,
        type: 'skill',
        position: { x: 700, y: 200 },
        data: {
          label: '数据分析',
          config: {
            type: 'skill',
            name: '数据分析',
            prompt: `请分析以下数据并生成详细报告，包括：
1. 数据概览和统计信息
2. 发现的模式和趋势
3. 异常值和特殊情况
4. 关键洞察和建议

数据：
\`\`\`json
{{formattedData}}
\`\`\``,
            outputVariable: 'analysisReport',
          },
          status: 'idle',
        },
      },
      // Skill 4: 保存报告
      {
        id: nodeIds.writeReport,
        type: 'filesystem',
        position: { x: 900, y: 200 },
        data: {
          label: '保存报告',
          config: {
            type: 'filesystem',
            action: 'write',
            path: './reports/data-analysis.md',
            content: '# 数据分析报告\n\n{{analysisReport}}',
            outputVariable: 'reportPath',
          },
          status: 'idle',
        },
      },
      // 输出节点
      {
        id: nodeIds.output,
        type: 'output',
        position: { x: 1100, y: 200 },
        data: {
          label: '输出报告',
          config: {
            type: 'output',
            variableName: 'analysisReport',
            format: 'text',
          },
          status: 'idle',
        },
      },
    ],
    edges: [
      {
        id: nanoid(),
        source: nodeIds.input,
        target: nodeIds.readData,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.readData,
        target: nodeIds.transform,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.transform,
        target: nodeIds.analyze,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.analyze,
        target: nodeIds.writeReport,
        type: 'success',
      },
      {
        id: nanoid(),
        source: nodeIds.writeReport,
        target: nodeIds.output,
        type: 'default',
      },
    ],
    variables: {
      dataFilePath: './data.json',
    },
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 批量文件处理工作流模板
 * 列出文件 → 循环处理 → 汇总结果
 */
export function createBatchFileProcessingWorkflow(): WorkflowDefinition {
  const nodeIds = {
    input: nanoid(),
    listFiles: nanoid(),
    processFile: nanoid(),
    output: nanoid(),
  };

  return {
    id: nanoid(),
    name: '批量文件处理',
    description: '列出目录中的所有文件，逐个使用 Claude AI 处理',
    category: 'automation',
    tags: ['batch', 'automation', 'files'],
    nodes: [
      // 输入节点
      {
        id: nodeIds.input,
        type: 'input',
        position: { x: 100, y: 200 },
        data: {
          label: '目录路径',
          config: {
            type: 'input',
            variableName: 'dirPath',
            variableType: 'string',
            defaultValue: './input',
            description: '要处理的文件目录',
          },
          status: 'idle',
        },
      },
      // Skill 1: 列出文件
      {
        id: nodeIds.listFiles,
        type: 'filesystem',
        position: { x: 350, y: 200 },
        data: {
          label: '列出文件',
          config: {
            type: 'filesystem',
            action: 'list',
            path: '{{dirPath}}',
            outputVariable: 'fileList',
          },
          status: 'idle',
        },
      },
      // Skill 2: 处理文件
      {
        id: nodeIds.processFile,
        type: 'skill',
        position: { x: 600, y: 200 },
        data: {
          label: '批量处理',
          config: {
            type: 'skill',
            name: '批量处理',
            prompt: `以下是文件列表，请为每个文件生成处理报告：

文件列表：
{{fileList}}

请以 Markdown 格式输出，包括：
1. 文件总数
2. 每个文件的简要说明
3. 建议的下一步操作`,
            outputVariable: 'batchResult',
          },
          status: 'idle',
        },
      },
      // 输出节点
      {
        id: nodeIds.output,
        type: 'output',
        position: { x: 850, y: 200 },
        data: {
          label: '输出结果',
          config: {
            type: 'output',
            variableName: 'batchResult',
            format: 'text',
          },
          status: 'idle',
        },
      },
    ],
    edges: [
      {
        id: nanoid(),
        source: nodeIds.input,
        target: nodeIds.listFiles,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.listFiles,
        target: nodeIds.processFile,
        type: 'default',
      },
      {
        id: nanoid(),
        source: nodeIds.processFile,
        target: nodeIds.output,
        type: 'default',
      },
    ],
    variables: {
      dirPath: './input',
    },
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 获取所有预定义模板
 */
export const WORKFLOW_TEMPLATES = {
  codeAnalysis: createCodeAnalysisWorkflow,
  textProcessing: createTextProcessingWorkflow,
  dataAnalysis: createDataAnalysisWorkflow,
  batchFileProcessing: createBatchFileProcessingWorkflow,
};

/**
 * 模板元数据
 */
export const TEMPLATE_METADATA = [
  {
    key: 'codeAnalysis',
    name: '代码分析与文档生成',
    description: '自动读取代码文件，使用 Claude AI 进行分析，并生成技术文档',
    category: 'coding',
    icon: 'codicon-file-code',
    color: 'blue',
  },
  {
    key: 'textProcessing',
    name: '文本处理与优化',
    description: '读取文本，使用 Claude AI 优化内容，根据质量评分保存到不同位置',
    category: 'writing',
    icon: 'codicon-edit',
    color: 'green',
  },
  {
    key: 'dataAnalysis',
    name: '数据分析与报告生成',
    description: '读取数据文件，转换格式，使用 Claude AI 进行分析，生成可视化报告',
    category: 'analysis',
    icon: 'codicon-graph',
    color: 'purple',
  },
  {
    key: 'batchFileProcessing',
    name: '批量文件处理',
    description: '列出目录中的所有文件，逐个使用 Claude AI 处理',
    category: 'automation',
    icon: 'codicon-files',
    color: 'orange',
  },
] as const;
