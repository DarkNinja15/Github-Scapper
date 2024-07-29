const fastify = require("fastify")({ logger: true });
const { default: axios } = require("axios");
const { default: parse } = require("node-html-parser");
const dotenv = require("dotenv");
const { default: mongoose } = require("mongoose");
const User = require("./models/User");
const puppeteer = require('puppeteer');

dotenv.config();

const colors = ["#4CAF50", "#FF9800", "#2196F3", "#F44336", "#9C27B0"];

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
  const title = root.querySelector("title").innerText;

  let username, name;
  const match = title.match(/^(.+?) \((.+?)\)/);
  if (match) {
    username = match[1];
    name = match[2];

    console.log("Username:", username);
    console.log("Name:", name);
  } else {
    console.log("Could not parse title format.");
  }

  const metaDescription = root.querySelector('meta[name="description"]');
  const bio = metaDescription ? metaDescription.getAttribute("content") : null;
  return { name, username, imageUrl, bio };
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
        language: name.replace(".", ""),
        score: percentage.replace("%", ""),
      };
      langs.push(score);
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

  langMap = Object.fromEntries(
    Object.entries(langMap).sort(([, a], [, b]) => b - a)
  );

  langMap = Object.fromEntries(Object.entries(langMap).slice(0, 7));

  console.log(langMap);

  let user = await get_user_profile(userName);
  console.log(user);

  return {
    languages: langMap,
    user: user,
  };
}

fastify.get("/:userName", async function handler(req, rep) {
  try {
    const userName = req.params.userName;
    console.log(userName);
    const existing_user = await User.findOne({ userName: userName });
    if (existing_user) {
      console.log("User found in database");

      const imageBuffer = await get_image_buffer(existing_user);
  
      return rep.type('image/png').send(imageBuffer);
    }
    console.log("User Not found in database");
    const user = await main(userName);
    const langs = new Map(Object.entries(user.languages));
    const newUser = new User({
      userName: userName,
      profileImageUrl: user.user.imageUrl,
      languages: langs,
      name: user.user.name,
      bio: user.user.bio,
    });
    console.log(newUser);
    await newUser.save();
    const imageBuffer = await get_image_buffer(newUser);
    return rep.type('image/png').send(imageBuffer);
  } catch (error) {
    console.log(error);
    return rep.status(500).send({ error: "An error occurred" });
  }
});



fastify.get("/hot-scrape/:userName", async function handler(req, rep) {
  try {
    const userName = req.params.userName;
    console.log(userName);

    await User.findOneAndDelete({
        userName: userName,
        });

    const user = await main(userName);
    const langs = new Map(Object.entries(user.languages));
    const newUser = new User({
      userName: userName,
      profileImageUrl: user.user.imageUrl,
      languages: langs,
      name: user.user.name,
      bio: user.user.bio,
    });
    console.log(newUser);
    await newUser.save();


    const imageBuffer = await get_image_buffer(newUser);
    return rep.type('image/png').send(imageBuffer);
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

function generate_html(user) {
console.log(user);
  let langHTML = `
        <div class="skills" style="margin-bottom: 1rem;">`;
  for (let [key, value] of user.languages) {
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
  <div id="scrapper" style="height: 440; width: 515;">
  <div class="card" style="padding: 2.5rem 2rem; border-radius: 10px; background-color: #000000; max-width: 500px; box-shadow: 0 0 30px rgba(0, 0, 0, .5);margin:0; box-sizing: border-box; position: relative; transform-style: preserve-3d; overflow: hidden;">
  <div style="display: flex; align-items: center;">
      <div class="img" style="border-radius: 50%; margin-right: 1rem;">
          <img src="${user.profileImageUrl}" style="width: 8rem; min-width: 80px; box-shadow: 0 0 0 5px #333; border-radius: 50%;">
      </div>
      <div>
          <div class="name" style="margin-bottom: 1rem;">
              <h2 style="font-size: 1.3rem; color: #E0E0E0;">${user.name}</h2>
              <h4 style="font-size: .8rem; color: #BBBBBB;">@${user.userName}</h4>
          </div>
          <p class="text" style="font-size: .9rem; margin-bottom: 1rem; color: #E0E0E0;">
              ${user.bio}
          </p>
      </div>
  </div>
  
  <div class="infos" style="margin-left: 1.5rem;">
      <div class="skills" style="margin-bottom: 1rem; margin-top: 1rem;">
          ${langHTML}
      </div>
  </div>
</div>
</div>
    `;

  return htmlContent;
}


async function get_image_buffer(user){
  const html = generate_html(user);
  console.log(html);
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
      await page.setContent(html);
      const dimensions = await page.evaluate(() => {
        const body = document.getElementById('scrapper');
    
        return { width: body.offsetWidth, height: body.offsetHeight };
      });
      console.log(dimensions);
      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height
      });
      const imageBuffer = await page.screenshot({
        type: 'png',
        omitBackground: true,
      });
      await browser.close();
  return imageBuffer;
}
