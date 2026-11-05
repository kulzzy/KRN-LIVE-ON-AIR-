/* KULZZY RADIO STREAM CONNECTION */

(function(){

    const audio = document.getElementById("radioAudio");
    const button = document.getElementById("listenButton");
    const status = document.getElementById("connectionStatus");
    const message = document.getElementById("playerMessage");

    if(!audio || !button) return;

    const streamURL =
        localStorage.getItem("kulzzy_stream_url") || "";

    if(!streamURL){
        button.disabled = true;
        message.textContent = "STREAM NOT CONFIGURED";
        return;
    }

    audio.src = streamURL;
    button.disabled = false;

    message.textContent = "Kulzzy Radio stream is ready.";

    button.addEventListener("click", async function(){

        if(audio.paused){

            try{
                await audio.play();
                button.textContent = "PAUSE LISTENING";
                status.textContent = "CONNECTING";
            }catch(error){
                message.textContent = "Unable to connect to stream.";
            }

        }else{

            audio.pause();
            button.textContent = "LISTEN NOW";

        }

    });

    audio.addEventListener("playing", function(){
        status.textContent = "LIVE";
        status.classList.add("connected");
        message.textContent = "You are listening to Kulzzy Radio.";
    });

    audio.addEventListener("error", function(){
        status.textContent = "STREAM UNAVAILABLE";
        status.classList.remove("connected");
        button.textContent = "LISTEN NOW";
    });

})();
