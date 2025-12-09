import fs from 'fs/promises';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const BACKGROUNDS_FILE = 'src/lib/backgrounds.json';

// Function to prompt the user for input
async function promptUser(query) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(query);
    rl.close();
    return answer.trim();
}

// Function to read the existing JSON file
async function readBackgrounds() {
    try {
        const data = await fs.readFile(BACKGROUNDS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`File ${BACKGROUNDS_FILE} not found. Starting with an empty array.`);
            return []; // Start with an empty array if the file doesn't exist
        }
        console.error("Error reading backgrounds file:", error.message);
        throw error;
    }
}

// Function to write the updated JSON array back to the file
async function writeBackgrounds(backgrounds) {
    try {
        // Use JSON.stringify with null, 4 for pretty printing (4 spaces indentation)
        await fs.writeFile(BACKGROUNDS_FILE, JSON.stringify(backgrounds, null, 4), 'utf-8');
        console.log(`\n✅ Successfully added the new background to ${BACKGROUNDS_FILE}`);
    } catch (error) {
        console.error("Error writing backgrounds file:", error.message);
        throw error;
    }
}

async function addBackground() {
    console.log("--- Add New Background Image ---");

    // 1. Get user inputs
    const imageLink = await promptUser("Image URL (link): ");
    const authorName = await promptUser("Author Name: ");
    const authorLink = await promptUser("Author Link: ");

    if (!imageLink || !authorName || !authorLink) {
        console.log("\n❌ Input required for all fields. Operation cancelled.");
        return;
    }

    // 2. Construct the new image object
    const newImage = {
        link: imageLink,
        author: {
            name: authorName,
            link: authorLink,
        },
    };

    // 3. Read, append, and write
    try {
        const backgrounds = await readBackgrounds();
        backgrounds.push(newImage);
        await writeBackgrounds(backgrounds);

        console.log("\nNew entry added:");
        console.log(JSON.stringify(newImage, null, 2));

    } catch (error) {
        console.error("\nAn error occurred during the update process.");
    }
}

addBackground();