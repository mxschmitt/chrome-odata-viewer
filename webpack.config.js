const webpack = require('webpack');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
    mode: "production",
    entry: {
        tab: "./tab.js",
        devtools: "./devtools.js"
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js'
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery'
        }),
        new CopyWebpackPlugin([
            { from: 'devtools.html' },
            { from: 'icon*.png' },
            { from: 'manifest.json' },
            { from: 'tab.html' }
        ])
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
                loader: 'url-loader',
                options: {
                    limit: 10000
                }
            }
        ]
    }
}
