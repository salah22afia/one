package org.gcc.usp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class UspApplication {
    public static void main(String[] args) {
        SpringApplication.run(UspApplication.class, args);
    }
}
