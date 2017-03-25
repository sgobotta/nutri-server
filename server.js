var express     = require('express');
var app         = express();
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var passport    = require('passport');
var config      = require('./config/database'); // get db config file
var User        = require('./app/models/user'); // get the mongoose model
var port        = process.env.PORT || 8081;
var jwt         = require('jwt-simple');
var async       = require('async');
var crypto      = require('crypto');
 
// using SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs
/*var helper = require('sendgrid').mail;*/
var sg = require('sendgrid')(process.env.SENDGRID_API_KEY);



// Get our request parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
 
// CORS handling
app.use(function(req,res,next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT');
  next();
})
app.use(morgan('dev'));
 
// Uses the passport package in our application
app.use(passport.initialize());
 
// Demo Route: (GET http://localhost:8080)
app.get('/', function(req, res) {
  res.send('Hello! The API is at http://localhost:' + port + '/api');
});


app.use('/static', express.static(__dirname + '/app/public'));

// Starts the server
app.listen(port);
console.log('There will be dragons: http://localhost:' + port);

/*sg.API(request, function(error, response) {
  console.log(response.statusCode);
  console.log(response.body);
  console.log(response.headers);
})*/


// demo Route (GET http://localhost:8080)
// ...
 
// connect to database
mongoose.connect(config.database);
 
// pass passport for configuration
require('./config/passport')(passport);
 
// bundle our routes
var apiRoutes = express.Router();

// connect the api routes under /api/*
app.use('/api', apiRoutes);
 
// create a new user account (POST http://localhost:8080/api/signup)
apiRoutes.post('/signup', function(req, res) {
  if(!req.body.email || !req.body.name || !req.body.password) {
    res.json({success: false, msg: 'Please pass mail, name and password.'});
  } else {
    var newUser = new User({
      email: req.body.email,
      name: req.body.name,
      password: req.body.password
    });
    // save the user
    newUser.save(function(err) {
      if(err) {
        return res.json({success: false, msg: 'Mail already exists.'});
      }
      res.json({success: true, msg: 'Successful created new user.'});
    });
  }
});

// route to authenticate a user (POST http://localhost:8080/api/authenticate)
apiRoutes.post('/authenticate', function(req, res) {
  User.findOne({
    email: req.body.email
  }, function(err, user) {
    if(err) throw err;
 
    if(!user) {
      res.send({success: false, msg: 'Authentication failed. User not found.'});
    } else {
      // check if password matches
      user.comparePassword(req.body.password, function(err, isMatch) {
        if (isMatch && !err) {
          // if user is found and password is right create a token
          var token = jwt.encode(user, config.secret);
          // return the information including token as JSON
          res.json({success: true, token: 'JWT ' + token});
        } else {
          res.send({success: false, msg: 'Authentication failed. Wrong password.'});
        }
      });
    }
  });
});

apiRoutes.post('/recover', function(req, res, next){
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf){
        var token = buf.toString('hex')
        done(err, token)
      });
    },
    function(token, done) {
      User.findOne({email: req.body.email}, function(err, user){
        if(!user){
          res.send({success: false, msg: "We're sorry, no users matched the provided email. "})
          return res.redirect('recover')
        }
        
        user.resetPasswordToken = token
        user.resetPasswordExpires = Date.now() + 3600000;

        user.save(function(err){
          done(err, token, user)
        })

      });
    },
    function(token, user, done){

      var content = 'Hello, ' + user.name + '\n\n' +
                    'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'

      var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: {
          personalizations: [
            {
              to: [{ email: user.email }],
              subject: 'Marina N Vazquez Nutrición: password change request',
            }
          ],
          from: { email: 'password-change-request@marinanvazquez.com' },
          content: [{ type: 'text/plain', value: content }]
        }
      })

      sg.API(request)
        .then(response => {
        console.log(response.statusCode)
        console.log(response.body)
        console.log(response.headers)        
        res.send({ success: true, msg: "An e-mail has been sent to " + user.email + ' with further instructions.' })
      }).catch(error => {
        console.log(error.response.statusCode)
        done(error, 'done');
      })
      /*done(error, 'done');*/

/*      sg.API(request, function(error,response){
        if(error){
          console.log('Sengrid error response received')
        } else {
          res.send({ success: true, msg: "An e-mail has been sent to " + user.email + ' with further instructions.' })
        }
        console.log(response.statusCode)
        console.log(response.body)
        console.log(response.headers)*/
    }
  ], 
  function(err){
    if(err) return next(err)
    console.log('redirecting from post recover')
    res.redirect('/forgot')
  })
})

apiRoutes.get('/reset/:token', function(req, res){
  User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  }, function(err, user){
    if(!user){
      res.send({success:false, msg: 'Password reset token is invalid or has expired.'})
    } else {
      res.send({success:true, msg: 'Redirecting to reset page.'})
    }
  })
})

apiRoutes.post('/reset/:token', function(req,res){
  async.waterfall([
    function(done){
      User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
      },
      function(err, user) {
        if(!user) {
          res.send({success: false, msg: 'Password reset token is invalid or has expired.'})
        } else {

          user.password = req.body.password
          user.resetPasswordToken = undefined
          user.resetPasswordExpires = undefined

          user.save(function(err){
            req.logIn(user, function(err){
              done(err, user)
            })
          })
        }
      })
    },
    function(user, done){

      var content = 'This is a confirmation that the password for your account' +
                    user.email + 'has just been changed.\n'

      var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: {
          personalizations: [
            {
              to: [{ email: user.email }],
              subject: 'Marina N Vazquez Nutrición: password reset confirmation',
            }
          ],
          from: { email: 'password-reset@marinanvazquez.com' },
          content: [ {type: 'text/plain', value: content }]
        }
      })

      sg.API(request)
        .then(response => {
        console.log(response.statusCode)
        console.log(response.body)
        console.log(response.headers)        
        res.send({ success: true, msg: 'Success ' + user.name + '! Your password has been changed' })
      }).catch(error => {
        console.log(error.response.statusCode)
        done(error, 'done');
      })

    }
  ],
  function(err){
    console.log('redirecting from post reset dash token')
  })
});


// route to a restricted info (GET http://localhost:8080/api/memberinfo)
apiRoutes.get('/memberinfo', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if(token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      email: decoded.email
    }, function(err, user) {
        if(err) throw err;
 
        if(!user) {
          console.log("auth failed")
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          res.json({success: true, msg: 'Welcome in the member area ' + user.email + '!'});
        }
    });
  } else {
    console.log("no token")
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});
 
getToken = function(headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(' ');
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};