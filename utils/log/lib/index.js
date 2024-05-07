import npmlog from 'npmlog';

// 判断 debug 模式
npmlog.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';
// 自定义前缀
npmlog.heading = 'tom'
// 添加自定义命令
npmlog.addLevel('success', 2000, {fg: 'green'})
export default npmlog
