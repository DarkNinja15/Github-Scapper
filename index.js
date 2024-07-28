const fastify = require("fastify")({ logger: true });
const { default: axios } = require("axios");
const { default: parse } = require("node-html-parser");
const dotenv = require("dotenv");
const { default: mongoose } = require("mongoose");
const User = require("./models/User");
dotenv.config();


const colors = [
    "#4CAF50",
    "#FF9800",
    "#2196F3",
    "#F44336",
    "#9C27B0",
];

async function get_repositories(userName) {
  let repos = [];

  for (let pageNo = 1; ; pageNo++) {
    const resp = await axios.get(
      `https://github.com/${userName}?page=${pageNo}&tab=repositories`
    );
    const root = parse(resp.data);

    const linkElements = root.querySelectorAll(".wb-break-all a");

    if (linkElements.length === 0) {
      break;
    }

    linkElements.forEach((element) => {
      repos.push(element.childNodes[0].rawText);
    });
  }
  repos = repos.map((item) => item.trim().replace(/\n/g, ""));
  repos = repos.filter((repo) => !repo.startsWith(userName));
  return repos;
}

async function get_user_profile(userName) {
  let resp = await axios.get(`https://github.com/${userName}`);
  const root = parse(resp.data);
  const imgElement = root.querySelector("img.avatar");
  const imageUrl = imgElement?.getAttribute("src");
  return imageUrl;
}

async function get_languages(userName, repo) {
  let langs = [];
  let resp = await axios.get(`https://github.com/${userName}/${repo}`);
  const root = parse(resp.data);

  const listItems = root.querySelectorAll(".list-style-none > li.d-inline");

  const languages = root.querySelectorAll(
    ".list-style-none li a, .list-style-none li span"
  );

  languages.forEach((language) => {
    const name = language
      .querySelector("span.color-fg-default.text-bold")
      ?.text.trim();
    const percentage = language
      .querySelector("span:not(.color-fg-default.text-bold)")
      ?.text.trim();
    if (name && percentage) {
      const score = {
        language: name,
        score: percentage.replace("%", ""),
      };
      if(name !== "Visual Basic .NET"){
        langs.push(score);
      }
    }
  });

  return langs;
}

async function main(userName) {
  let repos = await get_repositories(userName);
  let langMap = {};
  for (let i = 0; i < repos.length; i++) {
    let langs = await get_languages(userName, repos[i]);
    langs.forEach((lang) => {
      if (langMap[lang.language]) {
        langMap[lang.language] += parseInt(lang.score);
        langMap[lang.language] /= 2;
      } else {
        langMap[lang.language] = parseInt(lang.score);
      }
    });
  }
  let maxScore = 0;
  for (let key in langMap) {
    maxScore += langMap[key];
  }
  for (let key in langMap) {
    langMap[key] = ((langMap[key] / maxScore) * 100).toFixed(2);
  }
  console.log(langMap);

  let imageUrl = await get_user_profile(userName);
  console.log(imageUrl);

  return {
    languages: langMap,
    profile_image: imageUrl,
  };
}

fastify.get("/:userName", async function handler(req, rep) {
  try {
    const userName = req.params.userName;
    console.log(userName);
    const existing_user = await User.findOne({ userName: userName });
    if (existing_user) {
        console.log("User found in database");
        let langHTML = 
        `
        <div class="skills" style="margin-bottom: 1rem;">
        
        `;

        for (let [key, value] of existing_user.languages) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            langHTML += `
            <div class="skill" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; background-color: ${color};"></span>
                <span class="skill-name" style="flex: 1; font-size: 0.9rem; color: #E0E0E0;">${key}</span>
                <span class="percentage" style="font-size: 0.9rem; color: #E0E0E0;">${value}%</span>
            </div>
            `;
        }
        langHTML += `
        </div>`;


      const htmlContent = `
      <div class="card" style="padding: 2.5rem 2rem; border-radius: 10px; background-color: #1E1E1E; max-width: 500px; box-shadow: 0 0 30px rgba(0, 0, 0, .5); margin: 1rem; position: relative; transform-style: preserve-3d; overflow: hidden;">
    <div class="img" style="border-radius: 50%;">
        <img src="${existing_user.profileImageUrl}" style="width: 8rem; min-width: 80px; box-shadow: 0 0 0 5px #333; border-radius: 50%;">
    </div>
    <div class="infos" style="margin-left: 1.5rem;">
        <div class="name" style="margin-bottom: 1rem;">
            <h2 style="font-size: 1.3rem; color: #E0E0E0;">${userName}</h2>
            <h4 style="font-size: .8rem; color: #BBBBBB;">@bradsteve</h4>
        </div>
        <p class="text" style="font-size: .9rem; margin-bottom: 1rem; color: #E0E0E0;">
            I'm a Front End Developer, follow me to be the first 
            who see my new work.
        </p>
        ${langHTML}
    </div>
</div>
    `;
    const buffer = Buffer.from(htmlContent, "utf-8");
    return rep.type("text/html").send(buffer);
    }
    console.log("User Not found in database");
    const user = await main(userName);
    const langs = new Map(Object.entries(user.languages));
    const newUser = new User({
      userName: userName,
      profileImageUrl: user.profile_image,
      languages: langs,
    });
    console.log(newUser);
    await newUser.save();
    return rep.send(
      `
            <div class="card" style="padding: 2.5rem 2rem; border-radius: 10px; background-color: #1E1E1E; max-width: 500px; box-shadow: 0 0 30px rgba(0, 0, 0, .5); margin: 1rem; position: relative; transform-style: preserve-3d; overflow: hidden;">
    <div class="img" style="border-radius: 50%;">
        <img src="${user.profile_image}" style="width: 8rem; min-width: 80px; box-shadow: 0 0 0 5px #333; border-radius: 50%;">
    </div>
    <div class="infos" style="margin-left: 1.5rem;">
        <div class="name" style="margin-bottom: 1rem;">
            <h2 style="font-size: 1.3rem; color: #E0E0E0;">${userName}</h2>
            <h4 style="font-size: .8rem; color: #BBBBBB;">@bradsteve</h4>
        </div>
        <p class="text" style="font-size: .9rem; margin-bottom: 1rem; color: #E0E0E0;">
            I'm a Front End Developer, follow me to be the first 
            who see my new work.
        </p>
        <div class="skills" style="margin-bottom: 1rem;">
            <div class="skill" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; background-color: #4CAF50;"></span>
                <span class="skill-name" style="flex: 1; font-size: 0.9rem; color: #E0E0E0;">HTML</span>
                <span class="percentage" style="font-size: 0.9rem; color: #E0E0E0;">90%</span>
            </div>
            <div class="skill" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; background-color: #2196F3;"></span>
                <span class="skill-name" style="flex: 1; font-size: 0.9rem; color: #E0E0E0;">CSS</span>
                <span class="percentage" style="font-size: 0.9rem; color: #E0E0E0;">85%</span>
            </div>
            <div class="skill" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; background-color: #FF9800;"></span>
                <span class="skill-name" style="flex: 1; font-size: 0.9rem; color: #E0E0E0;">JavaScript</span>
                <span class="percentage" style="font-size: 0.9rem; color: #E0E0E0;">80%</span>
            </div>
            <div class="skill" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; background-color: #F44336;"></span>
                <span class="skill-name" style="flex: 1; font-size: 0.9rem; color: #E0E0E0;">React</span>
                <span class="percentage" style="font-size: 0.9rem; color: #E0E0E0;">75%</span>
            </div>
            <div class="skill" style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                <span class="dot" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; background-color: #9C27B0;"></span>
                <span class="skill-name" style="flex: 1; font-size: 0.9rem; color: #E0E0E0;">Node.js</span>
                <span class="percentage" style="font-size: 0.9rem; color: #E0E0E0;">70%</span>
            </div>
        </div>
    </div>
</div>
            `
    );
  } catch (error) {
    console.log(error);
    return rep.status(500).send({ error: "An error occurred" });
  }
});

fastify.listen({ port: 3000 }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${fastify.server.address().port}`);
  mongoose
    .connect(process.env.MongoURI, {})
    .then(() => console.log("Connected to MongoDB!"))
    .catch((err) => console.error("Could not connect to MongoDB..."));
});
