const { omit } = require("lodash");
const { dbV3 } = require("../config/database");
const { migrate } = require("./helpers/migrate");
const { migrateItem } = require("./helpers/migrateFields");

const {
  processRelation,
  migrateRelations,
} = require("./helpers/relationHelpers");

var relations = [];
const skipAttributes = ["created_by", "updated_by"];

async function migrateModels(tables) {
  console.log("Migrating Models");
  const modelsDefs = await dbV3("core_store").where(
    "key",
    "like",
    "model_def_application::%"
  );

  for (const modelDefEntry of modelsDefs) {
    const modelDef = JSON.parse(modelDefEntry.value);
    const cName = modelDef.collectionName;

    const omitAttributes = [];

    if (cName === "meeting_services") {
      omitAttributes.push(
        "inclusions_en",
        "inclusions_id",
        "inclusions_ja",
        "inclusions_ko",
        "inclusions_zh"
      );
    }

    if (cName === "booking_codes") {
      omitAttributes.push("description", "rate_code_override");
    }

    if (cName === "offers") {
      omitAttributes.push("link");
    }

    if (cName === "room_types") {
      omitAttributes.push("adult_price", "child_price");
    }

    if (cName === "rates") {
      omitAttributes.push(
        "booking_code",
        "formula",
        "hotel",
        "language_details",
        "name_id",
        "name_ja",
        "name_ko",
        "name_zh",
        "parent_rate_id",
        "rate_category",
        "days_modifier"
      );
    }

    if (cName === "wedding_venues") {
      omitAttributes.push("round_table_capacity");
    }

    if (cName === "meeting_venues") {
      omitAttributes.push("meeting_venue_type");
    }

    if (cName === "room_classes") {
      omitAttributes.push("description", "name");
    }

    if (cName === "room_tags") {
      omitAttributes.push(
        "name_en",
        "name_id",
        "name_ja",
        "name_ko",
        "name_zh"
      );
    }

    if (cName === "activities") {
      omitAttributes.push("activity_type");
    }

    if (cName === "offices") {
      omitAttributes.push("hotel");
    }

    if (cName === "hotels") {
      omitAttributes.push("booking_code", "office");
    }

    if (cName === "seasonal_policies") {
      omitAttributes.push("description", "hotel", "policy", "rate", "room");
    }

    if (cName === "policies") {
      omitAttributes.push(
        "hotel",
        "name_en",
        "name_id",
        "name_ja",
        "name_ko",
        "name_zh",
        "rate",
        "type"
      );
    }

    if (cName === "cards") {
      omitAttributes.push("boat_type", "package", "venue_type");
    }

    if (cName === "facilities") {
      omitAttributes.push("opening_hours");
    }

    if (cName === "spas") {
      omitAttributes.push("brochure_link");
    }

    if (cName === "stay_preferences") {
      omitAttributes.push(
        "category_display_name_en",
        "category_display_name_id",
        "category_display_name_ja",
        "category_display_name_ko",
        "category_display_name_zh",
        "category_language_details_en",
        "category_language_details_id",
        "category_language_details_ja",
        "category_language_details_ko",
        "category_language_details_zh",
        "days_modifier"
      );
    }

    if (cName === "booking_codes" || cName === "extras") {
      omitAttributes.push("days_modifier");
    }

    for (const [key, value] of Object.entries(modelDef.attributes)) {
      if (skipAttributes.includes(key)) {
        continue;
      }
      if (value.model || value.collection) {
        processRelation(
          {
            key,
            value,
            collectionName: modelDef.collectionName,
            uid: modelDef.uid,
          },
          relations
        );
        omitAttributes.push(key);
      }
    }
    await migrate(modelDef.collectionName, modelDef.collectionName, (item) => {
      if (modelDef.options.timestamps === false) {
        return migrateItem(item);
      } else {
        const timestamps =
          modelDef.options.timestamps === true
            ? ["created_at", "updated_at"]
            : modelDef.options.timestamps;
        const [createdAt, updatedAt] = timestamps;

        const newItem = {
          ...item,
          created_at: item[createdAt],
          updated_at: item[updatedAt],
        };

        let omitFields = [...omitAttributes];
        if (createdAt != "created_at") omitFields.push(createdAt);
        if (updatedAt != "updated_at") omitFields.push(updatedAt);

        return migrateItem(omit(newItem, omitFields));
      }
    });
  }
  await migrateRelations(tables, relations);
}

module.exports = {
  migrateModels,
};
