package database

import (
	"database/sql"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

func InitMySQL() {
	dbHost := os.Getenv("MYSQL_HOST")
	if dbHost == "" {
		dbHost = "mysql"
	}

	dbUser := os.Getenv("MYSQL_USER")
	if dbUser == "" {
		dbUser = "root"
	}

	dbPassword := os.Getenv("MYSQL_PASSWORD")
	if dbPassword == "" {
		dbPassword = "widowmaker"
	}

	dbName := os.Getenv("MYSQL_DATABASE")
	if dbName == "" {
		dbName = "cloud_master"
	}

	dsn := dbUser + ":" + dbPassword + "@tcp(" + dbHost + ":3306)/" + dbName + "?parseTime=true"
	
	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("❌ [MySQL Connection Error]: %v", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	err = DB.Ping()
	if err != nil {
		log.Printf("⚠️  [MySQL Ping Warning]: %v. Backend database not reachable.", err)
	} else {
		log.Println("🚀 [MySQL Connection]: Connected successfully to MySQL DB.")
	}
}
