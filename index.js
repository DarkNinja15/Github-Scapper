const { default: axios } = require("axios");
const { default: parse } = require("node-html-parser");

async function get_repositories(userName) {
    let repos = [];

    for (let pageNo = 1;; pageNo++) {
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
    let resp =  await axios.get(`https://github.com/${userName}`);
    const root = parse(resp.data);
    const imgElement = root.querySelector('img.avatar');
    const imageUrl = imgElement?.getAttribute('src');
    return imageUrl;
}

async function get_languages(userName,repo) {
    let langs=[];
    let resp = await axios.get(`https://github.com/${userName}/${repo}`);
    const root = parse(resp.data);

    const listItems = root.querySelectorAll('.list-style-none > li.d-inline');

    const languages = root.querySelectorAll('.list-style-none li a, .list-style-none li span');

    languages.forEach(language => {
        const name = language.querySelector('span.color-fg-default.text-bold')?.text.trim();
        const percentage = language.querySelector('span:not(.color-fg-default.text-bold)')?.text.trim();
        if (name && percentage) {
            const score = {
                "language": name,
                "score": percentage.replace('%', '')
            }
            langs.push(score);
        }
    });

    return langs;
}

async function main() {
    let userName = "";
    let repos = await get_repositories(userName);
    let langMap = {};
    for (let i = 0; i < repos.length; i++) {
        let langs = await get_languages(userName,repos[i]);
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
        maxScore+=langMap[key];
    }
    for (let key in langMap) {
        langMap[key] = ((langMap[key] / maxScore) * 100).toFixed(2);
    }
    console.log(langMap);


    let imageUrl = await get_user_profile(userName);
    console.log(imageUrl);
}

main();