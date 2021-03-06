Promise.all([
    fetchRecords(),
    fetchRules(),
    fetchPrebuilt(),
]).then((data) => {

    const url = new URL(document.location);

    const reasons = data[0],
        rules = data[1],
        prebuilt = data[2];
    console.log("reasons", reasons);
    console.log("rules", rules);
    console.log("prebuilt", prebuilt);

    /* === Build the Quick Access section === */
    const quickAccessLabel = $("#quickAccessLabel"),
        quickAccessToggle = $("#quickAccessToggle");
    const prebuiltWrapper = $("#prebuilt-links").on("util:regenerate", () => {
        prebuiltWrapper.html("");
        const customEnabled = quickAccessToggle.is(":checked");
        for (const link of prebuilt) {
            $("<a>")
                .attr({
                    "href": customEnabled ? link.custom : link.url,
                })
                .addClass("m-2")
                .text(link.title)
                .appendTo(prebuiltWrapper);
        }
    });;

    // Enable the switching of prebuilt links
    quickAccessToggle.on("click", () => {
        const customEnabled = quickAccessToggle.is(":checked");
        quickAccessLabel.text(customEnabled ? "Custom Reason" : "Quick Access");
        localStorage.setItem("quickAccessState", customEnabled);
        prebuiltWrapper.trigger("util:regenerate");
    });
    if (localStorage.getItem("quickAccessState") == "true") quickAccessToggle.prop("checked", true);
    prebuiltWrapper.trigger("util:regenerate");


    /* === Build the record builder form === */
    const output = $("#output");

    // Create the reasons dropdown
    const reasonDropdown = $("#input-reason").on("change", () => {
        output.trigger("util:regenerate");
        const value = reasonDropdown.val();
        $("#input-reason-custom-wrapper").toggleClass("d-none", value !== "custom");
    });
    for (const [name, text] of Object.entries(reasons)) {
        $("<option>")
            .attr({
                "value": name,
            })
            .html(text)
            .appendTo(reasonDropdown);
    }
    if (url.searchParams.has("reason")) {
        const importedReason = url.searchParams.get("reason");
        reasonDropdown.val(importedReason);
        if (importedReason == "custom")
            $("#input-reason-custom-wrapper").removeClass("d-none")
    }


    // Custom reason
    let timerReason = null;
    const reasonCustom = $("#input-reason-custom").on("input", () => {
        clearTimeout(timerReason);
        timerReason = setTimeout(() => { output.trigger("util:regenerate"); }, 200);
    });
    if (url.searchParams.has("custom"))
        reasonCustom.val(url.searchParams.get("custom"));

    // Keep track of sources
    let timeSources = null;
    const sources = $("#sources").on("input", () => {
        clearTimeout(timeSources);
        timeSources = setTimeout(() => { output.trigger("util:regenerate"); }, 200);
    });
    if (url.searchParams.has("sources"))
        sources.val(url.searchParams.get("sources"));

    // Add prebuilt rules
    const enabledRules = url.searchParams.has("rules") ? url.searchParams.get("rules").split(",") : [];
    const activeHotkeys = new Set();
    const rulesButtonsCommon = $("#rules-buttons-common"),
        rulesButtonsOther = $("#rules-buttons-other");
    for (const [name, rule] of Object.entries(rules)) {
        const button = $("<button>")
            .addClass("btn me-2 mb-2")
            .addClass(enabledRules.includes(name) ? "btn-dark" : "btn-outline-dark")
            .attr({
                "type": "button",
                "name": name,
            })
            .data("rule", rule)
            .html(rule.title)
            .on("click", () => {
                button.toggleClass("btn-dark btn-outline-dark");
                output.trigger("util:regenerate");
            })
            .appendTo(rule.common ? rulesButtonsCommon : rulesButtonsOther);
        if (rule.hotkey && !activeHotkeys.has(rule.hotkey)) {
            activeHotkeys.add(rule.hotkey);
            button.attr("title", "Hotkey: " + rule.hotkey);
            Mousetrap.bind(rule.hotkey, () => { button.trigger("click"); });
        }
    }

    // Reset button
    $("#button-reset").on("click", () => location.href = ".");

    // Regenerate the text whenever something changes
    output.on("util:regenerate", () => {

        // Fetch the reason
        const reasonValue = reasonDropdown.val();
        let reason = reasonValue == "custom" ? (reasonCustom.val() + "") : reasons[reasonValue];
        if (!reason) reason = "";

        // Add sources
        const sourceList = (sources.val() + "").split("\n").filter(n => n);
        let sourceOutput = [];
        if (sourceList.length == 0) sourceOutput = [];
        else if (sourceList.length == 1) sourceOutput = [`"[Source]":${processSource(sourceList[0])}`];
        else
            for (const [index, source] of sourceList.entries()) sourceOutput.push(`"[${index + 1}]":${processSource(source)}`);
        
        // Append rules excerpts
        const rulesOutput = [];
        const activeRules = [];
        for (const button of $(".rules-buttons").find("button.btn-dark").get()) {
            const ruleData = $(button).data("rule");
            const name = $(button).attr("name");
            activeRules.push(name);

            const ruleLines = [];
            for (const ruleLine of ruleData.rules)
                ruleLines.push((ruleLine.startsWith("*") ? "*" : "* ") + ruleLine);
            rulesOutput.push(`[section=${ruleData.title}]\n` +
                `[b]This category includes:[/b]\n\n` +
                `${ruleLines.join("\n")}\n\n` +
                `"[Code of Conduct - ${ruleData.title}]":${ruleData.link ? ruleData.link : `/wiki_pages/e621:rules#${name}`}\n` +
                `[/section]`
            );
        }

        // Compose the record text
        output.val(
            (reason.length > 0 ? (reason + " ") : "") + sourceOutput.join(" ") + "\n\n" +
            rulesOutput.join("\n")
        );

        // Update the URL
        const params = [];
        if (reasonValue !== "null") {
            url.searchParams.set("reason", reasonValue);
            if (reasonValue == "custom" && reasonCustom.val())
                url.searchParams.set("custom", reasonCustom.val() + "");
            else url.searchParams.delete("custom");
        } else {
            url.searchParams.delete("reason");
            url.searchParams.delete("custom");
        }

        if (sourceList.length > 0)
            url.searchParams.set("sources", sourceList.join("\n"));
        else url.searchParams.delete("sources");

        if (activeRules.length > 0)
            url.searchParams.set("rules", activeRules.join(","));
        else url.searchParams.delete("rules");


        const searchPrefix = url.searchParams.toString().length === 0 ? "" : "?";
        history.replaceState({}, "", url.origin + url.pathname + searchPrefix + url.searchParams.toString() + url.hash);
    });
    output.trigger("util:regenerate");
})


async function fetchRecords() {
    return new Promise((resolve) => {
        $.getJSON("reasons.json", (json) => resolve(json));
    });
}

async function fetchRules() {
    return new Promise((resolve) => {
        $.getJSON("rules.json", (json) => resolve(json));
    });
}

async function fetchPrebuilt() {
    return new Promise((resolve) => {
        $.getJSON("prebuilt.json", (json) => resolve(json));
    });
}

/**
 * Convert a source link into a common format
 * @param {string} source Source link
 */
function processSource(source) {
    return decodeURI(source)
        .replace(/https:\/\/e(?:621|926).net\//g, "/")              // Make links relative
        .replace(/\/posts\/(\d+)#comment-(\d+)/g, "/comments/$2")   // Convert comment links
        .replace(/\?lr=\d+&/, "?")                                  // Trim the tag history links
        ;
}
