#!/usr/bin/env node
import { argv } from 'process';
console.log('welcome');
console.log('本地开发实时生效');
const init = () => {
	console.log('test');
};

const command = argv[2];
const options = argv.slice(3);

let [option, param] = options;
option = option.replace('--', '');
console.log(option);
console.log(param);
if (command) {
	eval(command)();
} else {
	console.log('请输入命令');
}
