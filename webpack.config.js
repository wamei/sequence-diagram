 module.exports = {
     entry: './src/main.js',
     output: {
         path: __dirname,
         filename: 'bundle.js'
     },
     devServer: {
         contentBase: './',
         inline: true
     },
     module: {
         loaders: [
             {
                 test: /\.vue$/,
                 loaders: ['vue-loader']
             },
         ]
     }
};
