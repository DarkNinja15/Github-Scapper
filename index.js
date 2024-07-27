const { default: axios } = require("axios");
const { default: parse } = require("node-html-parser");




async function get_repositories(userName) {
    let repos = [];

    for(let pageNo = 1;pageNo<=5; pageNo++) {
        const resp = await axios.get(`https://github.com/${userName}?page=${pageNo}&tab=repositories`);
        const root = parse(resp.data);

        const linkElements = root.querySelectorAll('.wb-break-all a');

        linkElements.forEach((element) => {
            repos.push(element.childNodes[0].rawText);
        });
    }
    repos=repos.map(item => item.trim().replace(/\n/g, ''));
    return repos;
}

async function main() {
    let repos=await get_repositories("DarkNinja15");
    console.log(repos);
}

main();

