require('dotenv').config({ path: './server/.env' });
const mongoose = require('../server/node_modules/mongoose');
const User = require('../server/models/User');

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        const email = 'shyammangaonkar204@gmail.com';
        console.log(`Checking for email: ${email}`);

        const userByEmail = await User.findOne({ email: email });
        console.log("User by exact email:", userByEmail ? userByEmail._id : "NOT FOUND");

        // Check case insensitive
        const usersRegex = await User.find({ email: { $regex: new RegExp(email, 'i') } });
        console.log("User by regex:", usersRegex.length);

        // Update specific user
        const targetPhone = '8459311192'; // Matches "Shyam Mangaonkar"
        const emailToSet = 'shyammangaonkar204@gmail.com';

        console.log(`Updating user with phone ${targetPhone}...`);

        const user = await User.findOne({ phone: targetPhone });
        if (user) {
            user.email = emailToSet;
            // Fix legacy names if needed
            if (!user.firstName || !user.lastName) {
                const parts = (user.name || '').split(' ');
                user.firstName = parts[0] || 'Unknown';
                user.lastName = parts.slice(1).join(' ') || 'User';
            }
            await user.save();
            console.log("UPDATED USER:", user);
        } else {
            console.log("User not found for update.");
        }

        // Show total users
        const count = await User.countDocuments();
        console.log("Total Users:", count);

        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkUser();
