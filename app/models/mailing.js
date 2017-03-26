

var MailingModel = {
	recoveryNotification: {
		from: function() { 
			return 'password-change-request@marinanvazquez.com' 
		},
    subject: function() {
    	return  '[Marina N Vazquez Nutrición]: password change request'
    },
    content: function(userName, destUrl) { 
			return  'Hello, ' + userName + '.\n\n' +
              'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
              'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
              destUrl + ' \n\n' +
              'If you did not request this, please ignore this email and your password will remain unchanged.\n'
    }
	},
	recoveryConfirmation: {
		from: function() {
			return 'password-reset@marinanvazquez.com'
		},
		subject: function() {
			return '[Marina N Vazquez Nutrición]: password reset confirmation'
		},
		content: function(mail){
			return 'This is a confirmation that the password for your account ' +
              mail + ' has just been changed.\n'
		}

	}

}

module.exports = MailingModel