const STORAGE_KEY = "sea-story-treasure-run-index";
const STORY_LEVELS = ["A1", "A2", "B1", "B2", "C1"];

export const STORY_TREASURE_RUNS = [
  {
    id: "potato-dinner",
    genre: "funny",
    title: "Die Kartoffel-Lüge",
    sourceName: "Reddit TIFU / pretending not to know what a potato is",
    sourceUrl: "https://www.reddit.com/r/tifu/comments/2tdbig/tifu_by_pretending_to_not_know_what_a_potato_is/",
    levels: {
      A1: [
        { id: "potato-1", level: "A1", key: "Essen bei den Eltern", text: "Ben isst zum ersten Mal bei den Eltern seiner Freundin. Er ist nervös. Auf dem Tisch liegt Fleisch, Salat und eine Kartoffel. Alle sind freundlich." },
        { id: "potato-2", level: "A1", key: "Was ist das", text: "Ben sieht die Kartoffel. Er macht einen kleinen Witz. Er fragt: Was ist das? Die Eltern lachen kurz. Dann warten sie auf seine Antwort." },
        { id: "potato-3", level: "A1", key: "Die Lüge wird groß", text: "Ben sagt: Ich kenne Kartoffeln nicht. Jetzt ist es kein Witz mehr. Die Mutter erklärt die Kartoffel. Ben bleibt bei seiner Lüge." },
        { id: "potato-4", level: "A1", key: "Der Vater wird still", text: "Der Vater fragt noch einmal. Ben sagt wieder: Ich kenne das nicht. Am Tisch wird es sehr still. Seine Freundin schaut ihn böse an." },
        { id: "potato-5", level: "A1", key: "Kein zweites Essen", text: "Nach dem Essen ist alles vorbei. Die Freundin ist wütend. Ben versteht: Ein kleiner Witz kann ein ganzes Abendessen zerstören." },
      ],
      A2: [
        { id: "potato-1", level: "A2", key: "Essen bei den Eltern", text: "Ben ist zum ersten Mal bei den Eltern seiner Freundin eingeladen. Er möchte klug und lustig wirken. Das Essen sieht normal aus: Fleisch, Gemüse und Kartoffeln. Trotzdem ist er so nervös, dass er sofort zu viel redet." },
        { id: "potato-2", level: "A2", key: "Was ist das", text: "Als die Kartoffel auf seinem Teller liegt, fragt Ben plötzlich: Was ist das? Zuerst denken alle, es sei ein Witz. Ben merkt, dass sie lachen, und macht weiter, obwohl er schon weiß, dass es eine schlechte Idee ist." },
        { id: "potato-3", level: "A2", key: "Die Lüge wird groß", text: "Die Mutter erklärt geduldig, dass es eine Kartoffel ist. Ben sagt aber, er habe so etwas noch nie gesehen. Aus einem kleinen Spaß wird eine dumme Rolle, aus der er nicht mehr herauskommt." },
        { id: "potato-4", level: "A2", key: "Der Vater wird still", text: "Der Vater fragt, ob Ben wirklich keine Kartoffeln kennt. Ben bleibt stur und sagt ja. Jetzt lacht niemand mehr. Seine Freundin tritt ihn unter dem Tisch, aber Ben spielt weiter." },
        { id: "potato-5", level: "A2", key: "Kein zweites Essen", text: "Nach dem Abendessen sagt seine Freundin, dass er ihre Eltern beleidigt hat. Ben wollte nur witzig sein, aber er hat wie ein Verrückter gewirkt. Zu einem zweiten Familienessen wird er nicht eingeladen." },
      ],
      B1: [
        { id: "potato-1", level: "B1", key: "Essen bei den Eltern", text: "Ben besucht zum ersten Mal die Eltern seiner Freundin und setzt sich fest vor, einen guten Eindruck zu machen. Gerade deshalb redet er zu viel und sucht nach einem harmlosen Witz. Als das Abendessen serviert wird, fühlt sich der ganze Abend noch völlig normal an." },
        { id: "potato-2", level: "B1", key: "Was ist das", text: "Auf seinem Teller liegt eine Kartoffel, und Ben fragt aus irgendeinem Grund, was das sei. Für eine Sekunde funktioniert der Witz: Die Familie lacht. Doch statt zuzugeben, dass er natürlich weiß, was eine Kartoffel ist, entscheidet er sich, die Rolle weiterzuspielen." },
        { id: "potato-3", level: "B1", key: "Die Lüge wird groß", text: "Die Mutter erklärt ihm freundlich, dass Kartoffeln ein ganz normales Essen sind. Ben nickt ernst und behauptet, in seiner Familie habe es so etwas nie gegeben. Je länger er spricht, desto klarer wird, dass der Witz nicht mehr zu retten ist." },
        { id: "potato-4", level: "B1", key: "Der Vater wird still", text: "Der Vater wird misstrauisch und fragt nach, ob Ben wirklich noch nie eine Kartoffel gesehen hat. Ben sagt ja, obwohl seine Freundin ihn unter dem Tisch warnt. Die Stimmung kippt: Aus einem lustigen Moment wird eine peinliche Prüfung." },
        { id: "potato-5", level: "B1", key: "Kein zweites Essen", text: "Nach dem Essen erklärt seine Freundin ihm, wie absurd und unhöflich er gewirkt hat. Ben wollte spontan und charmant sein, aber er blieb zu lange in einer dummen Lüge stecken. Die Geschichte endet nicht dramatisch, sondern schlimmer: Alle erinnern sich an ihn als den Mann ohne Kartoffelwissen." },
      ],
      B2: [
        { id: "potato-1", level: "B2", key: "Essen bei den Eltern", text: "Ben betritt das Haus der Eltern seiner Freundin mit dem festen Plan, sympathisch, locker und ein bisschen witzig zu wirken. Gerade dieser Plan macht ihn verkrampft. Als das Essen beginnt, sucht er krampfhaft nach einer Gelegenheit, die Atmosphäre aufzulockern." },
        { id: "potato-2", level: "B2", key: "Was ist das", text: "Die Gelegenheit scheint auf seinem Teller zu liegen: eine völlig normale Kartoffel. Ben fragt, was dieses Ding sei, und alle lachen kurz. In diesem Moment müsste er den Witz beenden, doch aus Nervosität entscheidet er sich für die schlechteste mögliche Fortsetzung." },
        { id: "potato-3", level: "B2", key: "Die Lüge wird groß", text: "Er behauptet ernsthaft, er habe noch nie von Kartoffeln gehört. Die Mutter versucht freundlich zu erklären, was Kartoffeln sind, während Ben die Lüge mit unnötigen Details ausschmückt. Jede neue Erklärung macht die Situation nicht lustiger, sondern merkwürdiger." },
        { id: "potato-4", level: "B2", key: "Der Vater wird still", text: "Der Vater verliert langsam die Geduld und prüft Ben wie einen verdächtigen Zeugen. Seine Freundin versucht, ihn mit Blicken und Tritten zu stoppen, aber Ben bleibt in seiner Rolle gefangen. Am Tisch entsteht diese besondere Stille, in der jeder spürt, dass ein Abend beschädigt wurde." },
        { id: "potato-5", level: "B2", key: "Kein zweites Essen", text: "Später macht ihm seine Freundin klar, dass er nicht komisch, sondern respektlos und unheimlich gewirkt hat. Der eigentliche Witz der Geschichte liegt darin, dass nichts Schlimmes passiert ist und doch alles ruiniert wurde. Eine einzige harmlose Kartoffel reicht, um einen Menschen für immer als völligen Idioten erscheinen zu lassen." },
      ],
      C1: [
        { id: "potato-1", level: "C1", key: "Essen bei den Eltern", text: "Ben kommt zum ersten Abendessen mit den Eltern seiner Freundin und spürt diesen übertriebenen Druck, gleichzeitig höflich, intelligent und entspannt wirken zu müssen. Weil er nicht einfach normal sein kann, sucht er nach einem kleinen absurden Kommentar. Das Essen selbst bietet dafür eigentlich keinen Anlass." },
        { id: "potato-2", level: "C1", key: "Was ist das", text: "Dann liegt eine Kartoffel auf seinem Teller, und Ben fragt, was das sei. Für einen Moment ist es ein harmloser Scherz über eine Selbstverständlichkeit. Genau an dieser Stelle hätte ein vernünftiger Mensch gelacht, den Witz beendet und weitergegessen." },
        { id: "potato-3", level: "C1", key: "Die Lüge wird groß", text: "Stattdessen verwandelt Ben den Scherz in eine Biografie: Er behauptet, seine Familie habe nie Kartoffeln gegessen, niemand habe ihm je davon erzählt, und das ganze Konzept sei ihm fremd. Die Mutter reagiert noch höflich, aber ihre Erklärungen machen seine Rolle nur absurder." },
        { id: "potato-4", level: "C1", key: "Der Vater wird still", text: "Der Vater beginnt, die Geschichte nicht mehr als Spaß, sondern als Beleidigung oder seltsames Machtspiel zu lesen. Ben erkennt die Gefahr und bleibt trotzdem dabei, vermutlich aus jener Panik heraus, in der ein Rückzug peinlicher wirkt als der Untergang. Seine Freundin versucht vergeblich, ihn aus der Rolle zu reißen." },
        { id: "potato-5", level: "C1", key: "Kein zweites Essen", text: "Am Ende hat Ben nicht gelogen, um etwas zu verbergen, sondern nur, weil er einen missglückten Witz nicht sterben lassen konnte. Genau das macht die Geschichte so komisch und so schmerzhaft: Ein erwachsener Mensch verliert ein mögliches Familienverhältnis an eine Kartoffel. Es ist eine Katastrophe ohne Opfer, aber mit maximaler Fremdscham." },
      ],
    },
  },
  {
    id: "today-tomorrow",
    genre: "drama",
    title: "Heute du, morgen ich",
    sourceName: "Reddit AskReddit / Today you, tomorrow me",
    sourceUrl: "https://www.reddit.com/r/AskReddit/comments/elal2/comment/c18z0z2/",
    levels: {
      A1: [
        { id: "today-1", level: "A1", key: "Das Auto steckt fest", text: "Ein Mann fährt allein auf einer Straße. Sein Auto bleibt stecken. Es regnet. Er hat Angst und weiß nicht, was er tun soll." },
        { id: "today-2", level: "A1", key: "Eine Familie hält an", text: "Ein Auto hält an. Eine Familie steigt aus. Sie sprechen wenig Englisch, aber sie helfen sofort. Sie holen sein Auto aus dem Schlamm." },
        { id: "today-3", level: "A1", key: "Kein Geld", text: "Der Mann will Geld geben. Die Familie sagt nein. Sie lächeln. Sie sagen: Heute du, morgen ich." },
        { id: "today-4", level: "A1", key: "Essen und Wärme", text: "Die Familie nimmt ihn mit. Er bekommt Essen. Er sitzt in einem warmen Haus. Er fühlt sich nicht mehr allein." },
        { id: "today-5", level: "A1", key: "Der Satz bleibt", text: "Später vergisst er diese Nacht nicht. Der Satz bleibt in seinem Kopf. Hilfe ist manchmal einfach: Heute du, morgen ich." },
      ],
      A2: [
        { id: "today-1", level: "A2", key: "Das Auto steckt fest", text: "Ein Mann fährt nachts durch schlechtes Wetter. Sein Auto rutscht von der Straße und steckt fest. Er ist allein, nass und müde. Ohne Hilfe kommt er nicht weiter." },
        { id: "today-2", level: "A2", key: "Eine Familie hält an", text: "Nach einiger Zeit hält eine mexikanische Familie an. Sie kennen ihn nicht, aber sie steigen sofort aus. Gemeinsam schieben und ziehen sie das Auto aus dem Schlamm." },
        { id: "today-3", level: "A2", key: "Kein Geld", text: "Der Mann möchte ihnen Geld geben. Die Familie nimmt es nicht. Der Vater sagt einen einfachen Satz: Heute du, morgen ich. Damit meint er: Jeder Mensch braucht einmal Hilfe." },
        { id: "today-4", level: "A2", key: "Essen und Wärme", text: "Sie lassen ihn nicht einfach auf der Straße zurück. Sie nehmen ihn mit nach Hause, geben ihm Essen und trockene Kleidung. Erst dort merkt er, wie erschöpft er ist." },
        { id: "today-5", level: "A2", key: "Der Satz bleibt", text: "Viele Jahre später erinnert er sich noch an diese Familie. Nicht das Auto ist wichtig, sondern der Satz. Er lernt: Hilfe muss nicht groß sein, um ein Leben zu verändern." },
      ],
      B1: [
        { id: "today-1", level: "B1", key: "Das Auto steckt fest", text: "Ein Mann ist allein unterwegs, als sein Auto bei schlechtem Wetter von der Straße rutscht und im Schlamm stecken bleibt. Er versucht, sich selbst zu befreien, aber jeder Versuch macht die Situation schlimmer. Langsam wird ihm klar, dass er ohne fremde Hilfe dort nicht wegkommt." },
        { id: "today-2", level: "B1", key: "Eine Familie hält an", text: "Schließlich hält eine Familie an, die ihn nicht kennt und kaum mit ihm sprechen kann. Trotzdem diskutieren sie nicht lange, sondern helfen sofort. Mit Seilen, Kraft und Geduld ziehen sie sein Auto wieder auf die Straße." },
        { id: "today-3", level: "B1", key: "Kein Geld", text: "Der Mann ist erleichtert und will die Familie bezahlen. Der Vater lehnt das Geld ab und sagt: Heute du, morgen ich. Für ihn ist Hilfe kein Geschäft, sondern etwas, das Menschen einander schulden, weil jeder einmal in Not geraten kann." },
        { id: "today-4", level: "B1", key: "Essen und Wärme", text: "Die Familie fährt nicht einfach weiter, sondern nimmt ihn mit nach Hause. Dort bekommt er Essen, trockene Kleidung und einen Platz, an dem er sich beruhigen kann. Aus einer peinlichen Panne wird ein Abend, den er nie vergisst." },
        { id: "today-5", level: "B1", key: "Der Satz bleibt", text: "Jahre später erzählt er die Geschichte, weil der Satz der Familie in ihm weiterlebt. Er erinnert sich nicht nur an die Rettung, sondern an die Haltung dahinter. Man hilft heute einem Fremden, weil man morgen selbst der Fremde sein könnte." },
      ],
      B2: [
        { id: "today-1", level: "B2", key: "Das Auto steckt fest", text: "Ein Mann gerät nachts mit seinem Auto in eine Lage, die zunächst nur ärgerlich wirkt und dann schnell bedrohlich wird. Regen, Schlamm und Dunkelheit machen aus einer Panne eine Falle. Je länger er allein kämpft, desto deutlicher spürt er, wie dünn die Grenze zwischen Kontrolle und Hilflosigkeit ist." },
        { id: "today-2", level: "B2", key: "Eine Familie hält an", text: "Eine mexikanische Familie hält an, obwohl sie keinen Grund hat, sich in diese fremde Not einzumischen. Die Verständigung ist schwierig, aber ihr Handeln ist eindeutig. Sie organisieren Hilfe, ziehen das Auto heraus und behandeln den Mann nicht wie eine Belastung, sondern wie einen Gast, der Pech gehabt hat." },
        { id: "today-3", level: "B2", key: "Kein Geld", text: "Als der Mann Geld anbietet, lehnt der Vater es ab. Seine Erklärung ist schlicht und deshalb so stark: Heute du, morgen ich. Der Satz macht aus der Rettung keine Heldentat, sondern eine Regel des Zusammenlebens." },
        { id: "today-4", level: "B2", key: "Essen und Wärme", text: "Die Familie nimmt ihn anschließend mit, gibt ihm Essen und lässt ihn zur Ruhe kommen. Gerade diese zweite Hilfe trifft ihn besonders, weil sie nicht mehr notwendig wäre. Sie retten nicht nur sein Auto, sondern auch sein Gefühl, in einer fremden Situation völlig allein zu sein." },
        { id: "today-5", level: "B2", key: "Der Satz bleibt", text: "Später wird aus der Erinnerung eine Art innerer Kompass. Der Mann versteht, dass Großzügigkeit nicht immer feierlich aussieht; manchmal trägt sie Arbeitskleidung, spricht mit Akzent und verschwindet wieder in der Nacht. Was bleibt, ist ein Satz, der ihn daran erinnert, selbst anzuhalten." },
      ],
      C1: [
        { id: "today-1", level: "C1", key: "Das Auto steckt fest", text: "Der Erzähler befindet sich nachts auf einer Straße, als eine gewöhnliche Autopanne durch Regen, Schlamm und Einsamkeit zu einer existenziellen kleinen Krise wird. Er ist nicht schwer verletzt, nicht in Lebensgefahr, aber vollkommen abhängig von Menschen, die keinen Grund haben, ihn zu beachten. Genau diese Art von Hilflosigkeit prägt die Erinnerung." },
        { id: "today-2", level: "C1", key: "Eine Familie hält an", text: "Eine mexikanische Familie hält an und verwandelt die Szene sofort. Zwischen ihnen gibt es Sprachbarrieren, kulturelle Distanz und keinerlei Verpflichtung, doch ihr Handeln ist schneller als jede Erklärung. Sie ziehen das Auto heraus und stellen damit eine Würde wieder her, die der Erzähler in der Panne verloren hatte." },
        { id: "today-3", level: "C1", key: "Kein Geld", text: "Sein Versuch, die Hilfe zu bezahlen, scheitert an einem Satz, der fast sprichwörtlich wirkt: Heute du, morgen ich. In dieser Antwort steckt keine Romantik, sondern eine praktische Ethik. Not wird nicht als persönliches Versagen betrachtet, sondern als etwas, das durch die Gemeinschaft wandert." },
        { id: "today-4", level: "C1", key: "Essen und Wärme", text: "Dass die Familie ihn anschließend mitnimmt, ernährt und wärmt, macht die Geschichte größer als eine Pannenhilfe. Sie beendet nicht nur ein Problem, sondern unterbricht auch die Scham, die mit Abhängigkeit verbunden ist. Der Mann erlebt für einen Abend eine Form von Gastfreundschaft, die keine Gegenleistung erwartet." },
        { id: "today-5", level: "C1", key: "Der Satz bleibt", text: "Jahre später bleibt nicht der technische Ablauf der Rettung entscheidend, sondern die moralische Einfachheit dieses Satzes. Er zwingt den Erzähler, Hilfe nicht als Ausnahme, sondern als zirkulierende Verantwortung zu verstehen. Heute du, morgen ich: ein kleiner Satz, der ein ganzes Menschenbild trägt." },
      ],
    },
  },
  {
    id: "jungle-survival",
    genre: "survival",
    title: "Elf Tage im Regenwald",
    sourceName: "Juliane Koepcke survival story",
    sourceUrl: "https://en.wikipedia.org/wiki/Juliane_Koepcke",
    levels: {
      A1: [
        { id: "jungle-1", level: "A1", key: "Das Flugzeug fällt", text: "Juliane fliegt mit ihrer Mutter. Es gibt ein Gewitter. Das Flugzeug fällt in den Regenwald. Juliane wacht allein auf." },
        { id: "jungle-2", level: "A1", key: "Allein im Wald", text: "Sie hat nur ein Kleid und einen Schuh. Sie ist verletzt. Überall sind Bäume, Wasser und Tiere. Sie sucht ihre Mutter." },
        { id: "jungle-3", level: "A1", key: "Der Bach zeigt den Weg", text: "Juliane erinnert sich an eine Regel. Kleines Wasser geht zu großem Wasser. Sie folgt einem Bach, weil dort vielleicht Menschen sind." },
        { id: "jungle-4", level: "A1", key: "Elf Tage gehen", text: "Sie geht viele Tage. Sie hat Hunger. In ihrer Wunde sind Insekten. Trotzdem geht sie weiter und bleibt am Wasser." },
        { id: "jungle-5", level: "A1", key: "Das Boot am Ufer", text: "Am Ende findet sie ein Boot und eine Hütte. Männer kommen zurück und helfen ihr. Nach elf Tagen lebt Juliane noch." },
      ],
      A2: [
        { id: "jungle-1", level: "A2", key: "Das Flugzeug fällt", text: "Juliane sitzt mit ihrer Mutter im Flugzeug nach Peru. Plötzlich kommt ein starkes Gewitter. Das Flugzeug zerbricht in der Luft. Als Juliane aufwacht, liegt sie allein im Regenwald." },
        { id: "jungle-2", level: "A2", key: "Allein im Wald", text: "Sie ist verletzt, trägt nur ein Kleid und hat nur einen Schuh. Sie ruft nach ihrer Mutter, aber niemand antwortet. Der Wald ist laut, nass und sehr dicht. Juliane weiß: Sie muss sich bewegen." },
        { id: "jungle-3", level: "A2", key: "Der Bach zeigt den Weg", text: "Von ihren Eltern hat sie gelernt, dass Wasser im Regenwald helfen kann. Ein kleiner Bach führt oft zu einem größeren Fluss. Und an einem Fluss gibt es vielleicht Menschen. Also folgt sie dem Wasser." },
        { id: "jungle-4", level: "A2", key: "Elf Tage gehen", text: "Tag für Tag geht sie weiter. Sie isst wenig und schläft schlecht. Ihre Wunde wird schlimmer, aber sie bleibt am Bach. Der Gedanke an Menschen am Fluss hält sie wach." },
        { id: "jungle-5", level: "A2", key: "Das Boot am Ufer", text: "Nach vielen Tagen findet Juliane ein Boot und eine kleine Hütte. Sie wartet dort, fast ohne Kraft. Als Waldarbeiter zurückkommen, retten sie sie. Sie hat elf Tage allein überlebt." },
      ],
      B1: [
        { id: "jungle-1", level: "B1", key: "Das Flugzeug fällt", text: "Juliane Koepcke fliegt mit ihrer Mutter über den peruanischen Regenwald, als ein Gewitter das Flugzeug trifft. Die Maschine zerbricht, und Juliane stürzt noch angeschnallt in ihrem Sitz in die Tiefe. Als sie wieder zu sich kommt, ist sie die einzige Person, die sie sehen kann." },
        { id: "jungle-2", level: "B1", key: "Allein im Wald", text: "Sie ist verletzt, hat nur einen Schuh und hört überall die Geräusche des Waldes. Zuerst sucht sie nach ihrer Mutter und nach anderen Menschen aus dem Flugzeug. Doch der Regenwald gibt ihr keine Antwort, und langsam versteht sie, dass sie allein handeln muss." },
        { id: "jungle-3", level: "B1", key: "Der Bach zeigt den Weg", text: "Juliane erinnert sich an das Wissen ihrer Eltern, die im Regenwald gearbeitet hatten. Wenn man Wasser findet, soll man ihm folgen, denn kleine Bäche führen zu größeren Flüssen. Und an größeren Flüssen sind die Chancen auf Menschen größer." },
        { id: "jungle-4", level: "B1", key: "Elf Tage gehen", text: "Elf Tage kämpft sie sich durch Schlamm, Pflanzen und Insekten. Sie hat kaum Essen, ihre Verletzungen entzünden sich, und nachts kann sie kaum schlafen. Trotzdem bleibt sie bei ihrer Entscheidung: immer weiter am Wasser entlang." },
        { id: "jungle-5", level: "B1", key: "Das Boot am Ufer", text: "Schließlich entdeckt sie ein Boot und eine einfache Hütte am Ufer. Dort wartet sie, bis Männer zurückkommen, die im Wald arbeiten. Sie bringen Juliane in Sicherheit. Ihre Rettung wirkt wie ein Wunder, aber sie beruht auch auf Wissen, Ruhe und einer einzigen richtigen Richtung." },
      ],
      B2: [
        { id: "jungle-1", level: "B2", key: "Das Flugzeug fällt", text: "Juliane Koepcke sitzt neben ihrer Mutter in einem Flugzeug, das über dem peruanischen Regenwald in ein schweres Gewitter gerät. Ein Blitz trifft die Maschine, sie zerbricht in der Luft, und Juliane stürzt, noch an ihren Sitz geschnallt, durch die Wolken. Als sie erwacht, liegt sie nicht in einem Krankenhaus, sondern mitten im Wald." },
        { id: "jungle-2", level: "B2", key: "Allein im Wald", text: "Sie ist verletzt, halb blind vor Schmerz und Schock, und trägt nur noch einen Schuh. Zunächst sucht sie nach ihrer Mutter und nach anderen Überlebenden, doch sie findet niemanden. Um sie herum ist der Regenwald nicht romantisch, sondern feindlich: nass, laut, dicht und völlig gleichgültig." },
        { id: "jungle-3", level: "B2", key: "Der Bach zeigt den Weg", text: "Was Juliane rettet, ist nicht Kraft, sondern Erinnerung. Ihre Eltern hatten ihr beigebracht, dass Wasser im Regenwald eine Richtung vorgibt. Ein Bach führt zu einem Fluss, ein Fluss vielleicht zu einem Lager, einem Boot oder einem Menschen. Also folgt sie dem Wasser." },
        { id: "jungle-4", level: "B2", key: "Elf Tage gehen", text: "Die nächsten elf Tage bestehen aus Hunger, Erschöpfung, Insekten, Schmerzen und der ständigen Gefahr, die Orientierung zu verlieren. Ihre Wunden entzünden sich, und jeder Schritt kostet mehr Kraft. Trotzdem trifft sie immer wieder dieselbe Entscheidung: nicht quer durch den Wald, sondern weiter entlang des Wassers." },
        { id: "jungle-5", level: "B2", key: "Das Boot am Ufer", text: "Am Ende findet Juliane tatsächlich ein Boot und eine kleine Hütte. Sie ist so schwach, dass sie dort bleiben muss, bis Waldarbeiter zurückkehren. Ihre Rettung ist deshalb keine einfache Wundergeschichte. Sie zeigt, wie ein bisschen Wissen, Disziplin und Glück zwischen Tod und Überleben stehen können." },
      ],
      C1: [
        { id: "jungle-1", level: "C1", key: "Das Flugzeug fällt", text: "Juliane Koepcke erlebt über dem peruanischen Regenwald eine Katastrophe, die jede Vorstellung von Kontrolle zerstört. Das Flugzeug, in dem sie neben ihrer Mutter sitzt, gerät in ein Gewitter, wird vom Blitz getroffen und zerbricht. Juliane fällt, noch an ihren Sitz gebunden, aus der zerfallenden Maschine in ein grünes Nichts." },
        { id: "jungle-2", level: "C1", key: "Allein im Wald", text: "Als sie erwacht, ist die Welt auf Schmerz, Regen und Geräusche reduziert. Sie ist verletzt, desorientiert und trägt kaum etwas, das ihr Schutz bieten könnte. Der erste Impuls ist menschlich: Sie sucht ihre Mutter. Doch der Wald antwortet nicht, und aus Hoffnung wird allmählich eine Entscheidung zum Überleben." },
        { id: "jungle-3", level: "C1", key: "Der Bach zeigt den Weg", text: "Dass Juliane nicht planlos umherirrt, verdankt sie dem Wissen ihrer Eltern, die den Regenwald kannten. Wasser ist in dieser Landschaft nicht nur ein Mittel gegen Durst, sondern eine Karte. Wer einem Bach folgt, findet vielleicht einen Fluss; wer einen Fluss findet, findet vielleicht Menschen." },
        { id: "jungle-4", level: "C1", key: "Elf Tage gehen", text: "Elf Tage lang wird diese einfache Regel gegen Hunger, Entzündungen, Insekten und Erschöpfung geprüft. Der Regenwald zwingt sie, jede romantische Vorstellung von Natur aufzugeben. Überleben bedeutet hier nicht Heldentum, sondern die wiederholte, fast mechanische Entscheidung, trotz Angst und Schwäche weiterzugehen." },
        { id: "jungle-5", level: "C1", key: "Das Boot am Ufer", text: "Als Juliane schließlich ein Boot und eine Hütte erreicht, ist sie nicht gerettet, weil die Welt gerecht ist, sondern weil sie lange genug richtig gehandelt hat, bis Glück wieder möglich wurde. Waldarbeiter finden sie und bringen sie in Sicherheit. Die Geschichte bleibt erschütternd, weil sie zeigt, wie klein der Abstand zwischen Wissen, Zufall und Tod sein kann." },
      ],
    },
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shuffle(value) {
  const arr = [...value];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeIndex(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((Math.floor(n) % STORY_TREASURE_RUNS.length) + STORY_TREASURE_RUNS.length) % STORY_TREASURE_RUNS.length;
}

function readRunIndex() {
  try {
    return normalizeIndex(localStorage.getItem(STORAGE_KEY));
  } catch (_) {
    return 0;
  }
}

function saveRunIndex(index) {
  try {
    localStorage.setItem(STORAGE_KEY, String(normalizeIndex(index)));
  } catch (_) {
    // Private mode storage failures are harmless for story cycling.
  }
}

function readSelectedLevel() {
  const level = window.getSeaQuizSettings?.().level || "A2";
  return STORY_LEVELS.includes(level) ? level : "A2";
}

function runFragments(run, level) {
  return run.levels?.[level] || run.levels?.B2 || run.levels?.A2 || [];
}

function ensureStyles() {
  if (document.getElementById("storyTreasureStyles")) return;
  const style = document.createElement("style");
  style.id = "storyTreasureStyles";
  style.textContent = `
    #storyTreasurePanel {
      position: fixed;
      inset: 0;
      z-index: 82;
      display: none;
      place-items: center;
      padding: 18px;
      background: rgba(2, 8, 13, 0.76);
      pointer-events: auto;
    }
    #storyTreasurePanel .story-box {
      width: min(760px, calc(100vw - 28px));
      max-height: calc(100vh - 28px);
      overflow: auto;
      display: grid;
      gap: 14px;
      padding: 18px;
      border-radius: 8px;
      background: rgba(4, 18, 28, 0.94);
      border: 1px solid rgba(255, 226, 122, 0.44);
      box-shadow: 0 20px 70px rgba(0, 0, 0, 0.52);
    }
    #storyTreasurePanel .story-head {
      display: flex;
      gap: 12px;
      align-items: start;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 12px;
    }
    #storyTreasurePanel h2 {
      margin: 0;
      color: #ffe27a;
      font-size: 1.2rem;
      line-height: 1.2;
    }
    #storyTreasurePanel .story-meta {
      color: #8fd8c6;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }
    #storyTreasurePanel .story-instruction,
    #storyTreasurePanel .story-status {
      color: #cfe6f3;
      font-size: 0.84rem;
      line-height: 1.45;
    }
    #storyTreasurePanel .story-text {
      color: #fff;
      font-size: 1rem;
      line-height: 1.55;
      font-weight: 750;
      padding: 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(127, 216, 255, 0.18);
    }
    #storyTreasurePanel .story-key {
      display: inline-flex;
      width: fit-content;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(255, 226, 122, 0.13);
      color: #ffe27a;
      border: 1px solid rgba(255, 226, 122, 0.34);
      font-size: 0.8rem;
      font-weight: 900;
    }
    #storyTreasurePanel .story-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    #storyTreasurePanel button {
      min-height: 42px;
      border-radius: 8px;
      border: 1px solid rgba(255, 226, 122, 0.78);
      background: rgba(70, 42, 15, 0.9);
      color: #ffe27a;
      font: 900 0.84rem "Segoe UI", system-ui, sans-serif;
      cursor: pointer;
      padding: 9px 12px;
    }
    #storyTreasurePanel button:hover:not(:disabled) {
      background: rgba(105, 63, 20, 0.95);
    }
    #storyTreasurePanel button:disabled {
      opacity: 0.42;
      cursor: default;
    }
    #storyTreasurePanel .story-phrase-grid,
    #storyTreasurePanel .story-order-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }
    #storyTreasurePanel .story-phrase-grid button,
    #storyTreasurePanel .story-order-slot {
      min-height: 58px;
      text-align: center;
      white-space: normal;
      line-height: 1.25;
    }
    #storyTreasurePanel .story-order-slot {
      display: grid;
      place-items: center;
      border-radius: 8px;
      border: 1px dashed rgba(127, 216, 255, 0.35);
      color: #d9edf7;
      background: rgba(12, 46, 66, 0.72);
      padding: 8px;
      font-size: 0.78rem;
      font-weight: 800;
    }
    #storyTreasurePanel .story-order-slot.filled {
      border-style: solid;
      border-color: rgba(255, 226, 122, 0.65);
      color: #ffe27a;
      background: rgba(70, 42, 15, 0.82);
    }
    @media (max-width: 760px) {
      #storyTreasurePanel .story-head {
        display: grid;
      }
      #storyTreasurePanel .story-meta {
        white-space: normal;
      }
      #storyTreasurePanel .story-phrase-grid,
      #storyTreasurePanel .story-order-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function createPanel() {
  let panel = document.getElementById("storyTreasurePanel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "storyTreasurePanel";
    document.body.appendChild(panel);
  }
  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  panel.addEventListener("click", (event) => event.stopPropagation());
  return panel;
}

export class StoryTreasureMode {
  constructor({ onMessage, enterCursorMode, onRevealIsland, onSolved } = {}) {
    ensureStyles();
    this.onMessage = onMessage || (() => {});
    this.enterCursorMode = enterCursorMode || (() => {});
    this.onRevealIsland = onRevealIsland || (() => {});
    this.onSolved = onSolved || (() => {});
    this.runIndex = readRunIndex();
    this.run = STORY_TREASURE_RUNS[this.runIndex];
    this.level = readSelectedLevel();
    this.fragments = runFragments(this.run, this.level);
    this.panel = createPanel();
    this.active = false;
    this.collected = 0;
    this.storyComplete = false;
    this.islandRevealed = false;
    this.orderSolved = false;
    this.runWon = false;
    this.activeKind = "";
    this.currentFragmentIndex = -1;
    this.fragmentBeforeClose = null;
    this.fragmentAfterRead = null;
  }

  get total() {
    return this.fragments.length;
  }

  reset({ advanceStory = false } = {}) {
    if (advanceStory) {
      this.runIndex = normalizeIndex(this.runIndex + 1);
      saveRunIndex(this.runIndex);
    }
    this.run = STORY_TREASURE_RUNS[this.runIndex];
    this.level = readSelectedLevel();
    this.fragments = runFragments(this.run, this.level);
    this.active = false;
    this.collected = 0;
    this.storyComplete = false;
    this.islandRevealed = false;
    this.orderSolved = false;
    this.runWon = false;
    this.activeKind = "";
    this.currentFragmentIndex = -1;
    this.fragmentBeforeClose = null;
    this.fragmentAfterRead = null;
    this._hidePanel();
  }

  setRunContext({ runIndex = this.runIndex, level = this.level } = {}) {
    this.runIndex = normalizeIndex(runIndex);
    this.run = STORY_TREASURE_RUNS[this.runIndex];
    this.level = STORY_LEVELS.includes(level) ? level : readSelectedLevel();
    this.fragments = runFragments(this.run, this.level);
  }

  snapshot() {
    return {
      runIndex: this.runIndex,
      runId: this.run?.id || "",
      level: this.level,
      collected: this.collected,
      total: this.total,
      storyComplete: this.storyComplete,
      islandRevealed: this.islandRevealed,
      orderSolved: this.orderSolved,
      runWon: this.runWon,
      active: this.active,
      activeKind: this.activeKind,
      currentFragmentIndex: this.currentFragmentIndex,
    };
  }

  applySnapshot(snapshot = {}, options = {}) {
    if (!snapshot || typeof snapshot !== "object") return;
    this.setRunContext({
      runIndex: Number.isFinite(snapshot.runIndex) ? snapshot.runIndex : this.runIndex,
      level: STORY_LEVELS.includes(snapshot.level) ? snapshot.level : this.level,
    });
    if (Number.isFinite(snapshot.collected)) {
      this.collected = Math.max(0, Math.min(this.total, Math.floor(snapshot.collected)));
    }
    this.storyComplete = Boolean(snapshot.storyComplete) || this.collected >= this.total;
    this.islandRevealed = Boolean(snapshot.islandRevealed);
    this.orderSolved = Boolean(snapshot.orderSolved);
    this.runWon = Boolean(snapshot.runWon);
    if (!options.preserveActive && !snapshot.active) this._hidePanel();
  }

  markVictory() {
    this.runWon = true;
  }

  isIslandVisible() {
    return this.islandRevealed;
  }

  progressLabel() {
    return `Остров скрыт: собери фрагменты истории ${this.collected}/${this.total}. История ${this.runIndex + 1}/3, уровень ${this.level}.`;
  }

  introLine() {
    return `Режим сокровищ: потопи врагов, подбери 5 сундуков и прочитай историю от начала до конца. Вся история написана на выбранном уровне: ${this.level}.`;
  }

  collect({ onAfterRead, onBeforeClose } = {}) {
    if (this.collected >= this.total) {
      this.onMessage("История уже собрана. Лишний сундук можно взять как обычный трофей.");
      onAfterRead?.({ complete: true, extra: true });
      return null;
    }

    const fragment = this.fragments[this.collected];
    this.currentFragmentIndex = this.collected;
    this.collected += 1;
    this.storyComplete = this.collected >= this.total;
    this._showFragment(fragment, { onAfterRead, onBeforeClose });
    return fragment;
  }

  openFragmentFromSync(payload = {}, callbacks = {}) {
    this.setRunContext({
      runIndex: Number.isFinite(payload.runIndex) ? payload.runIndex : this.runIndex,
      level: STORY_LEVELS.includes(payload.level) ? payload.level : this.level,
    });
    const index = Math.max(0, Math.min(this.total - 1, Number(payload.fragmentIndex) || 0));
    const fragment = this.fragments[index];
    if (!fragment) return null;
    this.currentFragmentIndex = index;
    this.collected = Math.max(index + 1, Math.min(this.total, Number(payload.collected) || index + 1));
    this.storyComplete = Boolean(payload.storyComplete) || this.collected >= this.total;
    this.islandRevealed = Boolean(payload.islandRevealed);
    this.orderSolved = Boolean(payload.orderSolved);
    this._showFragment(fragment, callbacks);
    return fragment;
  }

  warnNeedFragments() {
    this.onMessage(`Остров пока скрыт. Нужно собрать все 5 сюжетных сокровищ: сейчас ${this.collected}/${this.total}.`);
  }

  handleIslandEntry({ onSolved } = {}) {
    if (!this.storyComplete || !this.islandRevealed) {
      this.warnNeedFragments();
      return true;
    }
    if (this.orderSolved) {
      (onSolved || this.onSolved)?.(this.run);
      return true;
    }
    this._showOrderPuzzle(onSolved || this.onSolved);
    return true;
  }

  _showFragment(fragment, callbacks = {}) {
    this.active = true;
    this.activeKind = "fragment";
    this.fragmentBeforeClose = callbacks.onBeforeClose || null;
    this.fragmentAfterRead = callbacks.onAfterRead || null;
    this.enterCursorMode();
    const count = this.collected;
    const done = this.storyComplete;
    this.panel.innerHTML = `
      <div class="story-box">
        <div class="story-head">
          <div>
            <h2>Сюжетное сокровище ${count}/${this.total}</h2>
            <div class="story-instruction">${escapeHtml(this.run.title)}</div>
          </div>
          <div class="story-meta">${escapeHtml(fragment.level)}</div>
        </div>
        <div class="story-instruction">
          Прочитай немецкий фрагмент. Запомни ключевую фразу: она понадобится на острове, чтобы восстановить порядок истории.
        </div>
        <div class="story-key">${escapeHtml(fragment.key)}</div>
        <div class="story-text">${escapeHtml(fragment.text)}</div>
        <div class="story-status">${done ? "Все пять фрагментов собраны. После закрытия панель откроет остров на компасе." : this.progressLabel()}</div>
        <div class="story-actions">
          <button type="button" data-story-close>${done ? "Открыть остров" : "Продолжить бой"}</button>
        </div>
      </div>
    `;
    this.panel.style.display = "grid";
    this.panel.querySelector("[data-story-close]")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeFragment();
    });
  }

  closeFragment({ notify = true } = {}) {
    if (this.activeKind !== "fragment") {
      this._hidePanel();
      return;
    }
    if (notify && this.fragmentBeforeClose?.({ complete: this.storyComplete, run: this.run }) === false) return;
    const afterRead = this.fragmentAfterRead;
    this.fragmentBeforeClose = null;
    this.fragmentAfterRead = null;
    this.currentFragmentIndex = -1;
    this._hidePanel();
    if (this.storyComplete && !this.islandRevealed) {
      this.islandRevealed = true;
      this.onRevealIsland(this.run);
    }
    if (notify) afterRead?.({ complete: this.storyComplete });
  }

  _showOrderPuzzle(onSolved) {
    this.active = true;
    this.activeKind = "order";
    this.currentFragmentIndex = -1;
    this.enterCursorMode();
    const correctIds = this.fragments.map((fragment) => fragment.id);
    const shuffledIds = shuffle(correctIds);
    const selected = [];
    const byId = new Map(this.fragments.map((fragment) => [fragment.id, fragment]));

    const render = (status = "Нажимай ключевые фразы в том порядке, в котором развивалась история.") => {
      const available = shuffledIds.filter((id) => !selected.includes(id));
      const selectedSlots = Array.from({ length: this.total }, (_, index) => {
        const fragment = byId.get(selected[index]);
        return `<button type="button" class="story-order-slot${fragment ? " filled" : ""}" data-remove-index="${index}">
          ${fragment ? escapeHtml(`${index + 1}. ${fragment.key}`) : escapeHtml(`${index + 1}. ...`)}
        </button>`;
      }).join("");
      this.panel.innerHTML = `
        <div class="story-box">
          <div class="story-head">
            <div>
              <h2>Островное задание</h2>
              <div class="story-instruction">${escapeHtml(this.run.title)}</div>
            </div>
            <div class="story-meta">История ${this.runIndex + 1}/3 · ${this.level}</div>
          </div>
          <div class="story-instruction">
            Восстанови ход истории по ключевым фразам. Начни с самого раннего события и доведи до финала.
          </div>
          <div class="story-order-grid">${selectedSlots}</div>
          <div class="story-phrase-grid">
            ${available.map((id) => `<button type="button" data-phrase-id="${escapeHtml(id)}">${escapeHtml(byId.get(id)?.key || id)}</button>`).join("")}
          </div>
          <div class="story-status" data-story-status>${escapeHtml(status)}</div>
          <div class="story-actions">
            <button type="button" data-story-reset>Сбросить</button>
            <button type="button" data-story-check ${selected.length === this.total ? "" : "disabled"}>Проверить порядок</button>
          </div>
        </div>
      `;
      this.panel.style.display = "grid";
      this.panel.querySelectorAll("[data-phrase-id]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          selected.push(button.dataset.phraseId);
          render();
        });
      });
      this.panel.querySelectorAll("[data-remove-index]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const index = Number(button.dataset.removeIndex);
          if (!selected[index]) return;
          selected.splice(index, 1);
          render("Фраза убрана. Можно выбрать другую.");
        });
      });
      this.panel.querySelector("[data-story-reset]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selected.length = 0;
        render("Порядок очищен. Собери цепочку заново.");
      });
      this.panel.querySelector("[data-story-check]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const ok = selected.length === correctIds.length && selected.every((id, index) => id === correctIds[index]);
        if (!ok) {
          selected.length = 0;
          render("Неверно.");
          return;
        }
        this.orderSolved = true;
        this._hidePanel();
        this.onMessage("Порядок истории восстановлен. Островное сокровище твоё.");
        onSolved?.(this.run);
      });
    };

    render();
  }

  _hidePanel() {
    this.active = false;
    this.activeKind = "";
    this.currentFragmentIndex = -1;
    this.panel.style.display = "none";
    this.panel.innerHTML = "";
  }
}
