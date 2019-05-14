'use strict';

const path = require('path');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

module.exports = {
	entry: './encode.js',
	// entry: './encode_browser.js',
	output: {
		path: path.resolve(__dirname, 'dist'),
	},
	performance: {
		hints: false
	},
	optimization: {
		minimize: false
	},
	plugins: [
		new WasmPackPlugin({
			crateDirectory: __dirname,
			extraArgs: '--target web -- -Z config-profile'
			// extraArgs: '-- -Z config-profile'
		})
	]
};
