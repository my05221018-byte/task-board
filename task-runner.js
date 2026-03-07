/**
 * 任务运行器 - 通过HTTP请求触发
 * 用于从网页执行自动评价任务
 */

const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const PORT = 3847;

const VALID_COMMANDS = {
    'run': 'node auto-evaluate.js run',
    'taobao': 'node auto-evaluate.js taobao',
    'jingdong': 'node auto-evaluate.js jingdong',
    'pinduoduo': 'node auto-evaluate.js pinduoduo',
    'douyin': 'node auto-evaluate.js douyin',
    'login-taobao': 'node auto-evaluate.js login taobao',
    'login-jingdong': 'node auto-evaluate.js login jingdong',
    'login-pinduoduo': 'node auto-evaluate.js login pinduoduo',
    'login-douyin': 'node auto-evaluate.js login douyin'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const command = url.pathname.slice(1);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    console.log(`[${new Date().toISOString()}] 收到请求: ${command}`);
    
    if (!command || !VALID_COMMANDS[command]) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: '无效的命令',
            available: Object.keys(VALID_COMMANDS)
        }));
        return;
    }
    
    const cmd = VALID_COMMANDS[command];
    const cwd = process.env.HOME + '/.openclaw/workspace';
    
    exec(cmd, { cwd }, (error, stdout, stderr) => {
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error.message,
                stderr: stderr
            }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            stdout: stdout,
            stderr: stderr
        }));
    });
});

server.listen(PORT, () => {
    console.log(`任务运行器已启动: http://localhost:${PORT}`);
    console.log('可用命令:');
    Object.keys(VALID_COMMANDS).forEach(cmd => {
        console.log(`  http://localhost:${PORT}/${cmd}`);
    });
});
