/**
 * 全平台自动评价系统
 * 支持：淘宝、京东、拼多多、抖音
 * 依赖：Node.js + Playwright
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIE_DIR = path.join(__dirname, 'cookies');
const LOG_DIR = path.join(__dirname, 'logs');

// 确保目录存在
[COOKIE_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 平台配置
const PLATFORMS = {
    taobao: {
        name: '淘宝',
        loginUrl: 'https://login.taobao.com/',
        orderUrl: 'https://trade.taobao.com/trade/itemlist/list_bought_items.htm',
        evaluateUrl: 'https://rate.taobao.com/',
        cookieFile: 'taobao.json'
    },
    jingdong: {
        name: '京东',
        loginUrl: 'https://passport.jd.com/uc/login/',
        orderUrl: 'https://order.jd.com/center/list.action',
        evaluateUrl: 'https://club.jd.com/myjd/myjdqueryEvaluateList.action',
        cookieFile: 'jingdong.json'
    },
    pinduoduo: {
        name: '拼多多',
        loginUrl: 'https://mobile.yangkeduo.com/login.html',
        orderUrl: 'https://mobile.yangkeduo.com/order.html',
        evaluateUrl: 'https://mobile.yangkeduo.com/evaluation.html',
        cookieFile: 'pinduoduo.json'
    },
    douyin: {
        name: '抖音',
        loginUrl: 'https://www.douyin.com/',
        orderUrl: 'https://www.douyin.com/aweme/v1/web/ecom/order/list/',
        evaluateUrl: 'https://www.douyin.com/feed',
        cookieFile: 'douyin.json'
    }
};

// 评价内容配置
const EVALUATE_CONFIG = {
    default: {
        star: 5,
        content: '商品质量很好，物流速度快，满意！'
    },
    taobao: {
        star: 5,
        content: '好评！'
    },
    jingdong: {
        star: 5,
        content: '速度快，质量好！'
    },
    pinduoduo: {
        star: 5,
        content: '物美价廉！'
    },
    douyin: {
        star: 5,
        content: '不错！'
    }
};

/**
 * 扫码登录获取Cookie
 */
async function loginWithQRCode(platform) {
    const config = PLATFORMS[platform];
    console.log(`[${config.name}] 正在启动浏览器...`);
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log(`[${config.name}] 请扫码登录...`);
    await page.goto(config.loginUrl);
    
    // 等待扫码成功
    await page.waitForFunction(() => {
        return window.location.href.includes('taobao') || 
               window.location.href.includes('jd.com') ||
               window.location.href.includes('yangkeduo') ||
               window.location.href.includes('douyin');
    }, { timeout: 120000 });
    
    // 等待一段时间确保登录完成
    await page.waitForTimeout(3000);
    
    // 获取Cookie
    const cookies = await context.cookies();
    const cookieData = {
        cookies: cookies,
        loginTime: new Date().toISOString()
    };
    
    // 保存Cookie
    const cookiePath = path.join(COOKIE_DIR, config.cookieFile);
    fs.writeFileSync(cookiePath, JSON.stringify(cookieData, null, 2));
    
    console.log(`[${config.name}] 登录成功！Cookie已保存`);
    await browser.close();
    
    return cookieData;
}

/**
 * 加载Cookie
 */
async function loadCookie(platform) {
    const config = PLATFORMS[platform];
    const cookiePath = path.join(COOKIE_DIR, config.cookieFile);
    
    if (!fs.existsSync(cookiePath)) {
        console.log(`[${config.name}] Cookie不存在，请先扫码登录`);
        return null;
    }
    
    const cookieData = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
    
    // 检查Cookie是否过期（7天）
    const loginTime = new Date(cookieData.loginTime);
    const now = new Date();
    const daysDiff = (now - loginTime) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 7) {
        console.log(`[${config.name}] Cookie已过期，请重新登录`);
        return null;
    }
    
    return cookieData;
}

/**
 * 检查并自动登录
 */
async function ensureLogin(platform) {
    let cookieData = await loadCookie(platform);
    
    if (!cookieData) {
        cookieData = await loginWithQRCode(platform);
    }
    
    return cookieData;
}

/**
 * 自动评价 - 淘宝
 */
async function evaluateTaobao() {
    console.log('[淘宝] 开始自动评价...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const cookieData = await ensureLogin('taobao');
    await context.addCookies(cookieData.cookies);
    
    await page.goto(PLATFORMS.taobao.orderUrl);
    await page.waitForTimeout(2000);
    
    // 获取待评价订单
    const orders = await page.evaluate(() => {
        const items = document.querySelectorAll('.trade-item');
        return Array.from(items).map(item => ({
            id: item.dataset.orderId,
            title: item.querySelector('.item-title')?.innerText,
            hasEvaluateBtn: !!item.querySelector('.evaluate-btn')
        })).filter(o => o.hasEvaluateBtn);
    });
    
    console.log(`[淘宝] 找到 ${orders.length} 个待评价订单`);
    
    let successCount = 0;
    for (const order of orders) {
        try {
            await page.goto(`${PLATFORMS.taobao.evaluateUrl}?orderId=${order.id}`);
            await page.waitForTimeout(1000);
            
            // 点击5星好评
            await page.click('.rate-star-5');
            await page.waitForTimeout(500);
            
            // 输入评价内容
            const config = EVALUATE_CONFIG.taobao;
            await page.fill('#evaluateContent', config.content);
            await page.waitForTimeout(500);
            
            // 提交评价
            await page.click('.submit-btn');
            await page.waitForTimeout(1000);
            
            successCount++;
            console.log(`[淘宝] 订单 ${order.id} 评价成功`);
        } catch (e) {
            console.log(`[淘宝] 订单 ${order.id} 评价失败: ${e.message}`);
        }
    }
    
    await browser.close();
    return successCount;
}

/**
 * 自动评价 - 京东
 */
async function evaluateJingdong() {
    console.log('[京东] 开始自动评价...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const cookieData = await ensureLogin('jingdong');
    await context.addCookies(cookieData.cookies);
    
    await page.goto(PLATFORMS.jingdong.orderUrl);
    await page.waitForTimeout(2000);
    
    // 获取待评价订单
    const orders = await page.evaluate(() => {
        const items = document.querySelectorAll('.order-item');
        return Array.from(items).map(item => ({
            id: item.dataset.orderId,
            hasEvaluateBtn: !!item.querySelector('.btn-evaluate')
        })).filter(o => o.hasEvaluateBtn);
    });
    
    console.log(`[京东] 找到 ${orders.length} 个待评价订单`);
    
    let successCount = 0;
    for (const order of orders) {
        try {
            await page.goto(`${PLATFORMS.jingdong.evaluateUrl}?orderId=${order.id}`);
            await page.waitForTimeout(1000);
            
            // 点击5星好评
            await page.click('.score-5');
            await page.waitForTimeout(500);
            
            const config = EVALUATE_CONFIG.jingdong;
            await page.fill('#content', config.content);
            await page.waitForTimeout(500);
            
            await page.click('.submit-btn');
            await page.waitForTimeout(1000);
            
            successCount++;
            console.log(`[京东] 订单 ${order.id} 评价成功`);
        } catch (e) {
            console.log(`[京东] 订单 ${order.id} 评价失败: ${e.message}`);
        }
    }
    
    await browser.close();
    return successCount;
}

/**
 * 自动评价 - 拼多多
 */
async function evaluatePinduoduo() {
    console.log('[拼多多] 开始自动评价...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const cookieData = await ensureLogin('pinduoduo');
    await context.addCookies(cookieData.cookies);
    
    await page.goto(PLATFORMS.pinduoduo.orderUrl);
    await page.waitForTimeout(2000);
    
    // 拼多多H5页面结构不同，需要滑动加载
    let orders = [];
    let scrollCount = 0;
    
    while (scrollCount < 3) {
        const newOrders = await page.evaluate(() => {
            const items = document.querySelectorAll('.order-item');
            return Array.from(items).map(item => ({
                id: item.dataset.orderId,
                hasEvaluateBtn: !!item.querySelector('.btn-evaluate')
            }));
        });
        
        orders = [...orders, ...newOrders];
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(1000);
        scrollCount++;
    }
    
    orders = orders.filter(o => o.hasEvaluateBtn);
    console.log(`[拼多多] 找到 ${orders.length} 个待评价订单`);
    
    let successCount = 0;
    for (const order of orders) {
        try {
            await page.goto(`${PLATFORMS.pinduoduo.evaluateUrl}?orderId=${order.id}`);
            await page.waitForTimeout(1500);
            
            // 拼多多评价逻辑
            await page.click('.star-5');
            await page.waitForTimeout(500);
            
            const config = EVALUATE_CONFIG.pinduoduo;
            await page.fill('textarea', config.content);
            await page.waitForTimeout(500);
            
            await page.click('.submit-btn');
            await page.waitForTimeout(1000);
            
            successCount++;
            console.log(`[拼多多] 订单 ${order.id} 评价成功`);
        } catch (e) {
            console.log(`[拼多多] 订单 ${order.id} 评价失败: ${e.message}`);
        }
    }
    
    await browser.close();
    return successCount;
}

/**
 * 自动评价 - 抖音
 */
async function evaluateDouyin() {
    console.log('[抖音] 开始自动评价...');
    
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const cookieData = await ensureLogin('douyin');
    await context.addCookies(cookieData.cookies);
    
    // 抖音需要先访问首页初始化
    await page.goto('https://www.douyin.com/');
    await page.waitForTimeout(2000);
    
    // 跳转订单页
    await page.goto('https://www.douyin.com/service/order/list/');
    await page.waitForTimeout(2000);
    
    const orders = await page.evaluate(() => {
        const items = document.querySelectorAll('.order-item');
        return Array.from(items).map(item => ({
            id: item.dataset.orderId,
            hasEvaluateBtn: !!item.querySelector('.evaluate-btn')
        })).filter(o => o.hasEvaluateBtn);
    });
    
    console.log(`[抖音] 找到 ${orders.length} 个待评价订单`);
    
    let successCount = 0;
    for (const order of orders) {
        try {
            await page.goto(`https://www.douyin.com/service/order/evaluate/${order.id}`);
            await page.waitForTimeout(1500);
            
            // 点击5星
            await page.click('.star-item:nth-child(5)');
            await page.waitForTimeout(500);
            
            const config = EVALUATE_CONFIG.douyin;
            await page.fill('textarea', config.content);
            await page.waitForTimeout(500);
            
            await page.click('.submit-btn');
            await page.waitForTimeout(1000);
            
            successCount++;
            console.log(`[抖音] 订单 ${order.id} 评价成功`);
        } catch (e) {
            console.log(`[抖音] 订单 ${order.id} 评价失败: ${e.message}`);
        }
    }
    
    await browser.close();
    return successCount;
}

/**
 * 运行所有平台评价
 */
async function runAll() {
    console.log('========== 全平台自动评价开始 ==========');
    console.log(`时间: ${new Date().toLocaleString()}`);
    
    const results = {};
    
    try {
        results.taobao = await evaluateTaobao();
    } catch (e) {
        console.log(`[淘宝] 错误: ${e.message}`);
        results.taobao = 0;
    }
    
    try {
        results.jingdong = await evaluateJingdong();
    } catch (e) {
        console.log(`[京东] 错误: ${e.message}`);
        results.jingdong = 0;
    }
    
    try {
        results.pinduoduo = await evaluatePinduoduo();
    } catch (e) {
        console.log(`[拼多多] 错误: ${e.message}`);
        results.pinduoduo = 0;
    }
    
    try {
        results.douyin = await evaluateDouyin();
    } catch (e) {
        console.log(`[抖音] 错误: ${e.message}`);
        results.douyin = 0;
    }
    
    console.log('========== 评价完成 ==========');
    console.log(`淘宝: ${results.taobao} 个`);
    console.log(`京东: ${results.jingdong} 个`);
    console.log(`拼多多: ${results.pinduoduo} 个`);
    console.log(`抖音: ${results.douyin} 个`);
    
    // 记录日志
    const logFile = path.join(LOG_DIR, `evaluate-${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify({
        time: new Date().toISOString(),
        results: results
    }, null, 2));
    
    return results;
}

/**
 * 扫码登录单个平台
 */
async function login(platform) {
    if (!PLATFORMS[platform]) {
        console.error(`未知平台: ${platform}`);
        console.log(`支持的平台: ${Object.keys(PLATFORMS).join(', ')}`);
        return;
    }
    
    await loginWithQRCode(platform);
}

// 命令行入口
const args = process.argv.slice(2);
const command = args[0];

if (command === 'login') {
    const platform = args[1];
    login(platform).then(() => process.exit(0));
} else if (command === 'run') {
    runAll().then(() => process.exit(0));
} else if (command === 'taobao') {
    evaluateTaobao().then(() => process.exit(0));
} else if (command === 'jingdong') {
    evaluateJingdong().then(() => process.exit(0));
} else if (command === 'pinduoduo') {
    evaluatePinduoduo().then(() => process.exit(0));
} else if (command === 'douyin') {
    evaluateDouyin().then(() => process.exit(0));
} else {
    console.log(`
自动评价系统
用法:
  node auto-evaluate.js login <平台>   扫码登录
  node auto-evaluate.js run             运行所有平台
  node auto-evaluate.js taobao         只运行淘宝
  node auto-evaluate.js jingdong       只运行京东
  node auto-evaluate.js pinduoduo      只运行拼多多
  node auto-evaluate.js douyin         只运行抖音

支持的平台: taobao, jingdong, pinduoduo, douyin
    `);
}

module.exports = { runAll, login, evaluateTaobao, evaluateJingdong, evaluatePinduoduo, evaluateDouyin };
