// import dependencies
require("dotenv").config();
const User = require("../models/Users")
const crypto = require("crypto")
const bcrypt = require("bcrypt");
const sendToMail = require("../middlewares/sendToMail")
const domain = process.env.DOMAIN
const key = process.env.api_key

// verify user email and send reset link
exports.verifyResetEmailAndSendLink = async (req, res) => {
    try {
          // verify user email and create reset token
	    const resetToken = crypto.randomBytes(32).toString("hex");
	    const { email } = req.body;
	    const verifiedUser = await User.findOne( { email } )
	    
	    if( !verifiedUser ) {
		console.log("User does not exist");
		res.redirect("../public/views/resetPassword.html")
	    }

            verifiedUser.resetToken = resetToken;
            verifiedUser.resetTokenExpiration = Date.now() + 3600000; 
            // current time in miliseconds + 1 hour in miliseconds
            
            await verifiedUser.save();

            // send reset link via mail
            const token = verifiedUser.resetToken;
           
            const text = `<h3> Here is the link to reset your password <h3> <br>
            <a href=http://localhost:5000/user/resetPassword/${token}>Reset Password</a>`

            const messageData = {
                from: 'Johnny Storm <jon@gmail.com>',
                to: email,
                subject: 'PASSWORD RESET LINK',
                html: text
            };
            
            sendToMail(res, domain, key, messageData)
        } 
        catch (err) {
            console.log(err)
        }
    }

// Update password in the database
exports.updatePassword = async (req, res) => {
	const { token } = req.params;
	const { newPassword, confirmPassword  } = req.body;
	const user = await User.findOne( { resetToken: token } );

	try {
		if (!token || token !== user.resetToken) {
			throw new Error ("Valid reset token is needed")
		}
		if (newPassword !== confirmPassword) {
			throw new Error("Passwords must match")
		}
		
		const verifyPassword = await bcrypt.compare(newPassword, user.password)

		if (verifyPassword) {
			throw new Error ("You cannot use an old password")
		}

		const securePass = await bcrypt.hash(newPassword, bcrypt.genSaltSync(10));
		
		const updatedPassword = await User.findOneAndUpdate(
                { resetToken: token }, 
                { password: securePass }, 
                { new: true, runValidators: true }
            ).select("firstName lastName email password")

		res.status(201).json(updatedPassword);
		res.redirect("../public/views/signin.html")
		console.log("Password has been successfully reset")
	} 
    	catch(err) {
		console.log(err)
		res.status(201).json(err.message)
	}
}
