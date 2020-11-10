const path = require('path');

module.exports = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'app.js',
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.(ts|js)$/,
                loader: 'swc-loader',
            },
        ],
    },
    mode: 'development',
    devtool: 'cheap-module-source-map',
    devServer: {
        hot: true,
        hotOnly: true,
    },
};
