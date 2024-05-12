import { readdirSync } from 'fs'
import { resolve } from 'path'
import inquirer from 'inquirer'
import fsExtra from 'fs-extra'
import { valid } from 'semver'
import userHome from 'userhome'
import kebabCase from 'kebab-case'
import { globSync } from 'glob'
import ejs from 'ejs'
import { writeFileSync } from 'fs'

import Command from '@t-cli/command'
import npmlog from '@t-cli/log'
import { Package } from '@t-cli/package'
import { spinnerStart, execSync } from '@t-cli/utils'
import { getNpmTemplates } from './getTemplates.js'

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'
const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'
const WHITE_COMMAND = ['npm', 'pnpm', 'yarn']

export class InitCommand extends Command {
	init() {
		this.projectName = this._argv[0] || ''
		this.force = !!this._cmd.getOptionValue('force')
		npmlog.verbose('projectName', this.projectName)
		npmlog.verbose('force', this.force)
	}

	async exec() {
		try {
			// 	1. 准备阶段
			const projectInfo = await this.prepare()
			this.projectInfo = projectInfo
			if (projectInfo) {
				npmlog.verbose('projectInfo', projectInfo)
				// 	2. 下载模版
				await this.downloadTemplate()
				// 	3. 安装模板
				await this.installTemplate()
			}
		} catch (e) {
			npmlog.error(e)
		}
	}

	async prepare() {
		this.templates = await getNpmTemplates()
		if (!this.templates || this.templates.length === 0) {
			throw new Error('项目模板不存在')
		}
		const localPath = process.cwd()
		// 	1. 判断当前目录是否为空
		if (!this.isDirEmpty(localPath)) {
			let isContinue = false
			if (!this.force) {
				// 	1.1 如果不为空，询问是否继续创建，并清空文件夹
				isContinue = (
					await inquirer.prompt({
						type: 'confirm',
						name: 'isContinue',
						default: false,
						message: '当前文件夹不为空，是否继续创建项目'
					})
				).isContinue
				if (!isContinue) return
			}
			if (isContinue || this.force) {
				const { confirmDelete } = await inquirer.prompt({
					type: 'confirm',
					name: 'confirmDelete',
					default: false,
					message: '是否确认清空当前文件夹下的所有内容'
				})
				if (confirmDelete) {
					// 	清空文件夹
					fsExtra.emptyDirSync(localPath)
				} else {
					return
				}
			}
		}
		return await this.getProjectInfo()
	}

	isDirEmpty(localPath) {
		npmlog.info('localPath', localPath)
		const fileList = readdirSync(localPath).filter(
			(file) => !file.startsWith('.') && !['node_modules'].includes(file)
		)
		npmlog.info('fileList', fileList)
		return !fileList || fileList.length <= 0
	}

	async getProjectInfo() {
		let projectInfo = {}
		const { type } = await inquirer.prompt({
			type: 'list',
			name: 'type',
			message: '请选择初始化类型',
			default: TYPE_PROJECT,
			choices: [
				{
					name: '项目',
					value: TYPE_PROJECT
				},
				{
					name: '组件',
					value: TYPE_COMPONENT
				}
			]
		})

		let projectNameIsValid = false
		if (isValidateProjectName(this.projectName)) {
			projectNameIsValid = true
			projectInfo.projectName = this.projectName
		}
		this.templates = this.templates.filter((template) => template.tag === type)
		npmlog.verbose('过滤后的npm模板列表', this.templates)

		const projectNamePrompt = {
			type: 'input',
			name: 'projectName',
			message: type === TYPE_PROJECT ? '请输入项目名称' : '请输入组件名称',
			default: '',
			validate: function (v) {
				const done = this.async()

				if (isValidateProjectName(v)) {
					done(null, true)
				} else {
					done(
						type === TYPE_PROJECT
							? '请输入合法的项目名称'
							: '请输入合法的组件名称'
					)
				}
			}
		}
		const createProjectPrompt = [
			{
				type: 'input',
				name: 'projectVersion',
				message:
					type === TYPE_PROJECT ? '请输入项目版本号' : '请输入组件版本号',
				default: '1.0.0',
				validate: function (v) {
					const done = this.async()
					if (valid(v)) {
						done(null, true)
					} else {
						done('请输入合法的版本号')
					}
				},
				filter: function (v) {
					return valid(v) ? valid(v) : v
				}
			},
			{
				type: 'list',
				name: 'projectTemplate',
				message: type === TYPE_PROJECT ? '请选择项目模板' : '请选择组件模板',
				choices: this.createTemplateChoice()
			}
		]
		if (!projectNameIsValid) {
			createProjectPrompt.unshift(projectNamePrompt)
		}

		if (type === TYPE_PROJECT) {
			const project = await inquirer.prompt(createProjectPrompt)
			projectInfo = {
				...projectInfo,
				type,
				...project
			}
		} else if (type === TYPE_COMPONENT) {
			// 	TODO:
			const descriptionPrompt = {
				type: 'input',
				name: 'componentDescription',
				message: '请输入组件描述信息',
				default: ''
			}
			createProjectPrompt.push(descriptionPrompt)
			// 	获取创建组件的基本信息
			const component = await inquirer.prompt(createProjectPrompt)
			projectInfo = {
				...projectInfo,
				type,
				...component
			}
		}

		// 将项目名称改为驼峰格式
		if (projectInfo?.projectName) {
			projectInfo.className = kebabCase(projectInfo.projectName).replace(
				/^-/,
				''
			)
			npmlog.verbose('className', projectInfo.className)
		}
		// 添加version字段，对应 ejs 渲染中的version字段
		if (projectInfo?.projectVersion) {
			projectInfo.version = projectInfo.projectVersion
		}
		// 添加description字段，对应 ejs 渲染中的description字段
		if (projectInfo?.componentDescription) {
			projectInfo.description = projectInfo?.componentDescription
		}

		return projectInfo
	}

	createTemplateChoice() {
		return this.templates.map((item) => ({
			value: item.npmName,
			name: item.name
		}))
	}

	/**
	 * 1.通过项目模板API获取项目模板信息
	 * 1.1.通过midway搭建接口
	 * 1.2.通过npm存储项目模板
	 * 1.3.通过midway获取mongodb中的数据并返回
	 * @returns {Promise<void>}
	 */
	async downloadTemplate() {
		const { projectTemplate } = this.projectInfo
		const templateInfo = this.templates.find(
			(item) => item.npmName === projectTemplate
		)
		this.templateInfo = templateInfo
		const targetPath = resolve(userHome(), '.t-cli', 'template')
		const storeDir = resolve(userHome(), '.t-cli', 'template', 'node_modules')
		const { npmName, version } = templateInfo
		const templateNpm = new Package({
			targetPath,
			storeDir,
			packageName: npmName,
			packageVersion: version
		})
		npmlog.verbose('templateNpm', templateNpm)
		// 如果本地没有就安装
		if (!(await templateNpm.exists())) {
			const spinner = spinnerStart()
			try {
				await templateNpm.install()
				spinner.succeed('模版下载成功!')
				this.templateNpm = templateNpm
			} catch (error) {
				npmlog.error(error.message)
				spinner.fail('模版下载失败，请检查版本号')
			}
		} else {
			const spinner = spinnerStart()
			try {
				await templateNpm.update()
				spinner.succeed('本地模版更新成功')
				this.templateNpm = templateNpm
			} catch (error) {
				npmlog.error(error.message)
				spinner.fail('本地模版更新失败，请检查版本号')
			}
		}
	}

	async installTemplate() {
		npmlog.verbose('installTemplate', this.templateInfo)
		if (this.templateInfo) {
			if (!this.templateInfo.type) {
				this.templateInfo.type = TEMPLATE_TYPE_NORMAL
			}
			if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
				// 	标准安装
				await this.installNormalTemplate()
			} else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
				// 	自定义安装
				await this.installCustomTemplate()
			} else {
				throw new Error('项目模板类型错误')
			}
		} else {
			throw new Error('项目模板信息不存在')
		}
	}

	async installNormalTemplate() {
		// 模板代码的目录
		const templatePath = resolve(
			this.templateNpm.storeDir,
			this.templateNpm.packageName,
			'template'
		)
		const targetPath = process.cwd()

		ensureAndCopyFiles(templatePath, targetPath)
		const { installCommand, startCommand, ignore } = this.templateInfo
		// const ignore = ['node_modules', 'public/**', 'index.html']
		npmlog.verbose('ignore', ignore?.split(',') ?? [])
		await this.ejsRender({
			ignore: (ignore?.split(',') ?? []).concat(['**/node_modules/**'])
		})

		await executeCommand(installCommand, '安装模板依赖')
		await executeCommand(startCommand, '启动模版服务')
	}
	ejsRender(options) {
		const dir = process.cwd()
		let projectInfo = this.projectInfo
		const files = globSync('**', {
			cwd: dir,
			nodir: true,
			ignore: options.ignore || ''
		})
		if (files) {
			Promise.all(
				files.map((file) => {
					const filePath = resolve(dir, file)
					return new Promise((resolve, reject) => {
						ejs.renderFile(filePath, projectInfo, (err, html) => {
							if (err) {
								reject(err)
							} else {
								writeFileSync(filePath, html)
								resolve(html)
							}
						})
					})
				})
			)
				.then(() => {})
				.catch((error) => {
					throw new Error(error.message)
				})
			return files
		} else {
			return []
		}
	}
	async installCustomTemplate() {
		npmlog.verbose('自定义安装')
	}
}

// 确保目录存在并且复制文件
const ensureAndCopyFiles = (templatePath, targetPath) => {
	const spinner = spinnerStart('正在安装模板')
	try {
		fsExtra.ensureDirSync(templatePath, {})
		fsExtra.ensureDirSync(targetPath, {})
		fsExtra.copySync(templatePath, targetPath)
		spinner.succeed('模板安装成功!')
	} catch (error) {
		spinner.fail('模板安装失败!')
		throw new Error(error.message)
	}
}

// 执行命令
const executeCommand = async (command, message) => {
	const spinner = spinnerStart(`正在${message}`)
	const [cmd, ...args] = command.split(' ')
	if (WHITE_COMMAND.includes(cmd)) {
		const result = await execSync(cmd, args, {
			stdio: 'inherit',
			cwd: process.cwd()
		})
		npmlog.info('命令执行结果', result)
		if (result !== 0) {
			spinner.fail(`${message}失败`)
			throw new Error(`${message}失败`)
		}
		spinner.succeed(`${message}成功`)
	} else {
		throw new Error('请配置合法的命令')
	}
}

/**
 * 1.首字符必须为英文字符
 * 2.尾字符必须为英文或数字，不能为空字符
 * 3.字符仅允许"-_"
 * 合法：a, a-b, a_b,a-b-c,a_b_c, a-b1-c1, a_b1_c1
 * 不合法：1,a_,a-,a_1,a-1
 * @param name
 * @returns {boolean}
 */
const isValidateProjectName = (name) => {
	const regExp =
		/^[a-zA-Z]+(-[a-zA-Z][a-zA-Z0-9]*|_[a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/
	return regExp.test(name)
}

/**
 * 默认导出 init 初始化的执行函数，在入口文件那里动态导入执行
 */
const init = (args) => {
	return new InitCommand(args)
}

export default init
