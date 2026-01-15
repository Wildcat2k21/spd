export default class Logger {
    constructor(selector){
        this.$logElem = document.querySelector(selector);
        this.logArr = [];
    }

    addLine(message){
        this.logArr.push(message);
        this.$logElem.value = this.logArr.join("\n");

        if(this.logArr.length > 10) {
            this.logArr.splice(0, 1);
        }
    }
}