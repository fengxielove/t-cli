import ora from 'ora'
import { spawn } from 'child_process'

export const isObject = (obj) =>
	Object.prototype.toString.call(obj) === '[object Object]'

export const spinnerStart = (text = '正在下载模板', spinner = 'dots') => {
	return ora({
		text,
		spinner
	}).start()
}

// 执行脚本命令
export const exec = (command, args, options = {}) => {
	const win32 = process.platform === 'win32'
	const cmd = win32 ? 'cmd' : command
	const cmdArgs = win32 ? ['/c'].concat(command, args) : args
	return spawn(cmd, cmdArgs, options || {})
}

export const execSync = (command, args, options) => {
	return new Promise((resolve, reject) => {
		const result = exec(command, args, options)
		result.on('error', (error) => {
			reject(error)
		})
		result.on('exit', (info) => {
			resolve(info)
		})
	})
}
