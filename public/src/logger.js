export default class Logger {
    constructor(selector){
        this.$logElem = document.querySelector(selector);
        this.logArr = [];
    }

    addLine(message){
        this.logArr.push(message);
        this.$logElem.value = this.logArr.map((line, index) => {
            const lineN = (index + 1).toString().padStart(2, "0");
            return `${lineN}: ${line}`
        }).join('\n');
        
        if(this.logArr.length > 9) {
            this.logArr = [];
        }
    }
}