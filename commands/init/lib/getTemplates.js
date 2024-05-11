import axios from '@t-cli/request'

export const getNpmTemplates = async () => {
	const { data } = await axios.post('/npm/templates/list')
	return data
}
