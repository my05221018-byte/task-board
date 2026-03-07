/**
 * 添加自动评价任务到任务管理系统
 */

const fs = require('fs');
const path = require('path');

// 任务配置
const task = {
    id: 'auto-evaluate',
    title: '🛍️ 全平台自动评价',
    desc: '自动评价淘宝/京东/拼多多/抖音订单',
    priority: 'medium',
    time: 22, // 每天22点运行
    days: [0, 1, 2, 3, 4, 5, 6],
    type: 'auto-evaluate',  // 自定义类型
    platforms: ['taobao', 'jingdong', 'pinduoduo', 'douyin']
};

const configPath = path.join(__dirname, 'auto-evaluate-task.json');
fs.writeFileSync(configPath, JSON.stringify(task, null, 2));

console.log('任务配置已保存到:', configPath);
console.log(JSON.stringify(task, null, 2));

// 创建运行脚本
const runScript = `#!/bin/bash
cd ~/.openclaw/workspace
node auto-evaluate.js run
`;

fs.writeFileSync(path.join(__dirname, 'run-evaluate.sh'), runScript);
console.log('运行脚本已保存');
