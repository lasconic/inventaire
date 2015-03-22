CONFIG = require 'config'
__ = CONFIG.root
_ = __.require 'builders', 'utils'

Promise = require 'bluebird'

nodemailer = require 'nodemailer'
hbs = require 'nodemailer-express-handlebars'
i18n = require './i18n/i18n'
viewsPath = __.path 'lib', 'emails/views'

options =
  viewEngine:
    extname: '.hbs'
    layoutsDir: "#{viewsPath}/layouts/"
    defaultLayout: 'template'
    partialsDir: "#{viewsPath}/partials/"
    helpers:
      i18n: i18n
      debug: ->
        console.log('this', this)
        console.log('arguments', arguments)
  viewPath: viewsPath
  extName: '.hbs'

transporter = nodemailer.createTransport CONFIG.mailer
transporter.use 'compile', hbs(options)

# binding context is needed for transporter.sendMail calls to 'this' to work
sendMail = Promise.promisify transporter.sendMail.bind(transporter)

module.exports =
  sendMail: (email)->
    sendMail email
    .then (res)-> _.success res, 'email sent'
    .catch (err)->
      _.error err, 'email error'
      _.warn email, 'associated email'
