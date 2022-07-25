const {
  dbV3,
  isPGSQL,
  isSQLITE,
  isMYSQL,
  dbV4,
} = require("../config/database");
const { omit } = require("lodash");
const { migrate } = require("./helpers/migrate");
const { singular } = require("pluralize");
const { migrateUids } = require("./helpers/migrateValues");
const { migrateItem } = require("./helpers/migrateFields");

const {
  processRelation,
  migrateRelations,
} = require("./helpers/relationHelpers");

var relations = [];
const skipAttributes = ["created_by", "updated_by"];

const processedTables = [];
async function migrateTables(tables) {
  console.log("Migrating components");

  const modelsDefs = await dbV3("core_store").where(
    "key",
    "like",
    "model_def_%"
  );

  const componentsToMigrate = modelsDefs
    .filter((item) => {
      if (item.key.includes("::")) {
        return false;
      }

      const jsonData = JSON.parse(item.value);

      return !jsonData.kind;
    })
    .map((item) => {
      const data = JSON.parse(item.value);

      return data.collectionName;
    });

  let componentRelationsTables = [];

  if (isPGSQL) {
    componentRelationsTables = (
      await dbV3("information_schema.tables")
        .select("table_name")
        .where("table_schema", "public")
        .where("table_name", "like", "%_components")
    )
      .map((row) => row.table_name)
      .filter((item) => !componentsToMigrate.includes(item));
  }

  if (isSQLITE) {
    componentRelationsTables = (
      await dbV3("sqlite_master")
        .select("name")
        .where("name", "like", "%_components")
    )
      .map((row) => row.name)
      .filter((item) => !componentsToMigrate.includes(item));
  }

  if (isMYSQL) {
    componentRelationsTables = (
      await dbV3("information_schema.tables")
        .select("table_name")
        .where("table_name", "like", "%_components")
    )
      .map((row) => row.table_name)
      .filter((item) => !componentsToMigrate.includes(item));
  }

  for (const table of componentsToMigrate) {
    const componentDefinition = modelsDefs.find(
      (item) => JSON.parse(item.value).collectionName === table
    );

    const componentDefinitionObject = JSON.parse(componentDefinition.value);
    const cName = componentDefinitionObject.collectionName;

    const omitAttributes = [];

    if (cName === "components_page_experiences") {
      omitAttributes.push("description");
    }

    if (cName === "components_wedding_packages") {
      omitAttributes.push(
        "list_en",
        "list_id",
        "list_ja",
        "list_ko",
        "list_zh"
      );
      omitAttributes.push(
        "subtitle_en",
        "subtitle_id",
        "subtitle_ja",
        "subtitle_ko",
        "subtitle_zh"
      );
    }

    if (cName === "components_room_room_rates") {
      omitAttributes.push("discount_rate");
    }

    if (cName === "components_stay_stay_preference_options") {
      omitAttributes.push(
        "name_en",
        "name_id",
        "name_ja",
        "name_ko",
        "name_zh"
      );
    }

    if (cName === "components_page_image_cards") {
      omitAttributes.push("ctaLink", "ctaText", "subtitle");
    }

    if (cName === "components_dates_date_ranges") {
      omitAttributes.push("type");
    }

    for (const [key, value] of Object.entries(
      componentDefinitionObject.attributes
    )) {
      if (skipAttributes.includes(key)) {
        continue;
      }
      if (value.model || value.collection) {
        processRelation(
          {
            key,
            value,
            collectionName: componentDefinitionObject.collectionName,
            uid: componentDefinitionObject.uid,
          },
          relations
        );

        // components_rate_override_normal_rates
        if (cName === "components_rate_override_normal_rates") {
          omitAttributes.push("rate");
        }
        // components_room_room_rates
        if (cName === "components_room_room_rates") {
          omitAttributes.push("room_type");
        }
        omitAttributes.push(key);
      }
    }

    await migrate(table, table, (data) => {
      const omitedData = omit(data, omitAttributes);

      return migrateItem(omitedData);
    });
    processedTables.push(table);
  }

  await migrateRelations([...componentsToMigrate, ...tables], relations);

  const componentsMap = modelsDefs
    .map((item) => JSON.parse(item.value))
    .reduce(
      (acc, item) => ({
        ...acc,
        [item.collectionName]: migrateUids(item.uid),
      }),
      {}
    );

  for (const table of componentRelationsTables) {
    const tableName = table.replace(/_components$/, "");

    const tableIdColumn = singular(tableName);

    await migrate(table, table, (item) => {
      const itemNew = {
        ...item,
        entity_id: item[`${tableIdColumn}_id`],
        component_type:
          componentsMap[item.component_type] ?? item.component_type,
      };

      return omit(itemNew, [`${tableIdColumn}_id`]);
    });
    processedTables.push(table);
  }
}

const migrateComponents = {
  processedTables,
  migrateTables,
};
module.exports = {
  migrateComponents,
};
