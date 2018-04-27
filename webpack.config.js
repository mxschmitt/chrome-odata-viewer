const webpack = require('webpack');
const path = require('path');

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
    watch: true,
    plugins: [
        new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery'
        })
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    {
                        loader: "style-loader",
                    },
                    {
                        loader: 'css-loader',
                        options: {
                            root: 'dist/',
                            publicPath: "dist/"
                        }
                    }
                ],
            }, {
                test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
                loader: 'url-loader',
                options: {
                    limit: 10000
                }
            },
        ]
    }
}
