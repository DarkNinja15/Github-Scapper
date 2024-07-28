const { Schema, default: mongoose } = require("mongoose");

const userSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    name: {
        type: String,
        trim: true,
    },
    bio: {
        type: String,
        trim: true,
    },
    languages: {
        type: Map,
        of: Number,
        required: true,
        validate: {
            validator: function (languages) {
            for (const value of languages.values()) {
                if (value < 0 || value > 100) return false;
            }
            return true;
            },
            message: "Language proficiency levels must be between 0 and 100.",
        },
    },
    profileImageUrl: {
        type: String,
    },
});

module.exports = mongoose.model("User", userSchema);
