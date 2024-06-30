const checkWinner = () => {
    for (let pattern of winPatterns) {
        let pos1 = boxes[pattern[0]].innerText;
        let pos2 = boxes[pattern[1]].innerText;
        let pos3 = boxes[pattern[2]].innerText;

        if (pos1 !== "" && pos2 !== "" && pos3 !== "") {
            if (pos1 === pos2 && pos2 === pos3) {
                console.log("Winner", pos1);
                return pos1;  
            }
        }
    }
    return null; 
}

let boxes = document.querySelectorAll(".box");
let resetBtn = document.querySelector("#reset-btn");
let newBtn = document.querySelector("#new-btn");
let msgContainer = document.querySelector(".msg-container");
let msg = document.querySelector("#msg");

let turn0 = true;
const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

boxes.forEach(box => {
    box.addEventListener("click", () => {
        console.log("box clicked");
        if (turn0) {
            box.innerText = "O";
        } else {
            box.innerText = "X";
        }
        turn0 = !turn0;
        box.disabled = true;
        let winner = checkWinner();
        if (winner) {
            showWinner(winner);
            disableBoxes();
        } else if (Array.from(boxes).every(box => box.innerText !== "")) {
            showDraw();
        }
    });
});

const showWinner = (winner) => {
    msg.innerText = `Congrats ${winner} is the Winner`;
    msgContainer.classList.remove("hide");
}

const showDraw = () => {
    msg.innerText = "It's a Draw!";
    msgContainer.classList.remove("hide");
}

const disableBoxes = () => {
    boxes.forEach(box => {
        box.disabled = true;
    });
}

const enableBoxes = () => {
    boxes.forEach(box => {
        box.disabled = false;
    });
}

const resetGame = () => {
    enableBoxes(); 
    boxes.forEach(box => {
        box.innerText = "";
        box.disabled = false;
    });
    msgContainer.classList.add("hide");
    turn0 = true;
}

resetBtn.addEventListener("click", resetGame);
newBtn.addEventListener("click", resetGame);
