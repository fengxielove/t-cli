import ora from 'ora'

export const isObject = (obj) =>
	Object.prototype.toString.call(obj) === '[object Object]'

export const spinnerStart = () => {
	return ora({
		text: '正在下载模版',
		spinner: 'dots'
	}).start()
}
