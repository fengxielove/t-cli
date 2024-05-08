import { sep } from 'path'

/**
 * 处理 macos 与 windows 的路径兼容性问题
 * @param p {string} 文件路径
 * @returns {*|string}
 */
export const formatPath = (p) => {
	if (p && typeof p === 'string') {
		if (sep === '/') {
			return p
		} else {
			return p.replace(/\\/g, '/')
		}
	}
	return p
}
